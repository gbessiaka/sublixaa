-- Planificateur (F-28, F-11) : pg_cron appelle l'application via pg_net.
-- L'URL du site et CRON_SECRET sont lus dans Supabase Vault (jamais dans ce fichier) :
--   select vault.create_secret('https://mon-domaine.com', 'app_url');
--   select vault.create_secret('<valeur de CRON_SECRET>', 'cron_secret');
-- Tant que ces deux secrets n'existent pas, les tâches ne font rien.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_app_cron(path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if app_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(app_url, '/') || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

-- Réservée au planificateur : aucun accès depuis l'API
revoke all on function public.invoke_app_cron(text) from public, anon, authenticated;

-- Publication des publications programmées : toutes les 5 minutes
select cron.schedule('publish-due-posts', '*/5 * * * *', $$ select public.invoke_app_cron('/api/cron/publish') $$);

-- Renouvellement des jetons et mise à jour des états : tous les jours à 7 h 17 UTC
select cron.schedule('refresh-social-tokens', '17 7 * * *', $$ select public.invoke_app_cron('/api/cron/tokens') $$);
