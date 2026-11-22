# Plateforme de gestion des réseaux sociaux avec IA (MVP)

Spécification : `docs/cahier-des-charges.pdf`. Consignes de développement : `CLAUDE.md`.

## Lancer en local

Prérequis : Node.js 20+ et Docker (pour Supabase en local).

1. `npm install`
2. `npm run db:start` : démarre Supabase en local et applique les migrations. Notez la *Publishable key* et la *Secret key* affichées.
3. Copier `.env.example` en `.env.local` et remplir au minimum :
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` (affichées à l'étape 2)
   - `ALLOWED_EMAILS` (votre adresse), `SITE_URL=http://localhost:3000`
   - `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`) et `CRON_SECRET` (`openssl rand -hex 32`)
   - une clé d'IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `GEMINI_API_KEY`) et `AI_PROVIDER`
4. `npm run user:create -- votre@adresse.com UnMotDePasse`
5. `npm run dev` puis ouvrir http://localhost:3000

Les courriels (lien magique) sont visibles dans Mailpit : http://127.0.0.1:54324

Pour tester le planificateur à la main :

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish
```

## Commandes

- `npm run dev` : serveur local
- `npm run build` : build de production
- `npm run lint` : vérification du code
- `npm run db:reset` : réinitialise la base locale (efface les données)
- `npm run db:types` : régénère les types TypeScript de la base
