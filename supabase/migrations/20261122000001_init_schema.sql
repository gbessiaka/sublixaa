-- Schéma initial (cahier des charges, section 8)
-- Règle : chaque table principale porte owner_id et est filtrée par RLS sur auth.uid().

-- ---------------------------------------------------------------------------
-- Fonction utilitaire : mise à jour automatique de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paramètres du propriétaire (F-37) : fournisseur et modèle d'IA, fuseau horaire
-- ---------------------------------------------------------------------------
create table public.owner_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ai_provider text,
  ai_model text,
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients (F-04 à F-08)
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  industry text,
  description text,
  tone text,
  target_audience text,
  goals text,
  products text,
  words_to_use text[] not null default '{}',
  words_to_avoid text[] not null default '{}',
  hashtags text[] not null default '{}',
  language text not null default 'fr',
  examples text[] not null default '{}' check (cardinality(examples) <= 5),
  logo_url text,
  brand_colors jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_owner_idx on public.clients (owner_id);

-- ---------------------------------------------------------------------------
-- Comptes sociaux (F-09 à F-12). Jetons chiffrés (NF-01), jamais lisibles
-- depuis le navigateur : voir les privilèges de colonnes plus bas.
-- network : identifiant libre (facebook, instagram, linkedin_person, linkedin_page, x…)
-- pour qu'ajouter un réseau ne demande pas de migration.
-- ---------------------------------------------------------------------------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  network text not null,
  external_id text not null,
  display_name text,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'expiring', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, network, external_id)
);
create index social_accounts_owner_idx on public.social_accounts (owner_id);
create index social_accounts_client_idx on public.social_accounts (client_id);

-- Comptes proposés après une autorisation OAuth, en attente de choix (ex. pages Facebook)
create table public.oauth_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  network text not null,
  external_id text not null,
  display_name text,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index oauth_candidates_owner_idx on public.oauth_candidates (owner_id);

-- ---------------------------------------------------------------------------
-- Stratégies mensuelles (F-13, F-14)
-- ---------------------------------------------------------------------------
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  monthly_goal text,
  pillars jsonb not null default '[]',
  frequency jsonb not null default '{}',
  theme_ideas jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);
create index strategies_owner_idx on public.strategies (owner_id);

-- ---------------------------------------------------------------------------
-- Publications (cœur de l'application)
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  strategy_id uuid references public.strategies (id) on delete set null,
  network text not null,
  pillar text,
  topic text,
  body text not null default '',
  hashtags text[] not null default '{}',
  visual_idea text,
  scheduled_at timestamptz,
  status text not null default 'draft' check (
    status in ('draft', 'to_review', 'scheduled', 'publishing', 'published', 'failed', 'published_manually')
  ),
  published_at timestamptz,
  published_url text,
  external_post_id text,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_owner_idx on public.posts (owner_id);
create index posts_client_idx on public.posts (client_id);
-- Le planificateur cherche les publications programmées dont l'heure est passée
create index posts_due_idx on public.posts (scheduled_at) where status = 'scheduled';

-- Médias d'une publication (table enfant, sécurisée par son parent)
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  size_bytes integer not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id);

-- Journal des tentatives de publication (NF-08), table enfant
create table public.publish_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  request_summary jsonb,
  response_status integer,
  response_body text,
  success boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publish_logs_post_idx on public.publish_logs (post_id);

-- Suivi des appels à l'IA (F-19)
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  strategy_id uuid references public.strategies (id) on delete set null,
  kind text not null check (kind in ('strategy', 'calendar', 'post', 'regenerate')),
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6),
  success boolean not null default true,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_generations_owner_idx on public.ai_generations (owner_id, created_at);

-- ---------------------------------------------------------------------------
-- Déclencheurs updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['owner_settings','clients','social_accounts','strategies','posts','post_media','publish_logs','ai_generations']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS (NF-02)
-- ---------------------------------------------------------------------------
alter table public.owner_settings enable row level security;
alter table public.clients enable row level security;
alter table public.social_accounts enable row level security;
alter table public.oauth_candidates enable row level security;
alter table public.strategies enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.publish_logs enable row level security;
alter table public.ai_generations enable row level security;

-- Tables avec owner_id : le propriétaire voit et modifie uniquement ses lignes
do $$
declare t text;
begin
  foreach t in array array['owner_settings','clients','social_accounts','oauth_candidates','strategies','posts','ai_generations']
  loop
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- Tables enfants : accès via la publication parente
create policy owner_all on public.post_media for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.owner_id = (select auth.uid())));

-- Journal : lecture seule pour le propriétaire ; écriture réservée au serveur (clé secrète)
create policy owner_select on public.publish_logs for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Jetons : jamais lisibles ni modifiables avec la clé publique (NF-01).
-- Seul le serveur, avec la clé secrète (service_role), y accède.
-- ---------------------------------------------------------------------------
revoke all on public.social_accounts from anon, authenticated;
grant select (id, owner_id, client_id, network, external_id, display_name, token_expires_at, scopes, metadata, status, created_at, updated_at)
  on public.social_accounts to authenticated;
grant delete on public.social_accounts to authenticated;

revoke all on public.oauth_candidates from anon, authenticated;
grant select (id, owner_id, client_id, network, external_id, display_name, created_at)
  on public.oauth_candidates to authenticated;
grant delete on public.oauth_candidates to authenticated;

-- Le statut d'une publication en cours d'envoi est géré par le serveur ;
-- l'utilisateur ne peut pas écrire dans publish_logs.
revoke insert, update, delete on public.publish_logs from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Stockage des images (F-20) : compartiment privé, dossier = owner_id
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 8388608, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "post_media_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "post_media_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "post_media_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
