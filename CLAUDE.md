# CLAUDE.md — Plateforme de gestion des réseaux sociaux avec IA (MVP)

## Le projet
Outil de gestion des réseaux sociaux « IA d'abord » : à partir de la fiche d'un client, l'IA propose une stratégie mensuelle et génère le calendrier de publications. Le propriétaire relit, valide, et l'application publie automatiquement.

- Utilisateur du MVP : un seul, le propriétaire, qui gère 3 clients.
- Réseaux : Facebook (pages), Instagram (comptes professionnels), LinkedIn (profils et pages), X. TikTok : génération seulement, publication manuelle.
- Objectif futur : devenir un SaaS multi-utilisateurs. Tout le code doit le permettre sans réécriture.
- Spécification complète : `docs/cahier-des-charges.md`. Les exigences y sont numérotées (F-01 à F-38, NF-01 à NF-15). Quand je cite un identifiant, va lire l'exigence correspondante.
- Langue : interface en français, code et noms de variables en anglais, commentaires en français.

## Stack
- Next.js (App Router), TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase : PostgreSQL, Auth, Storage
- Hébergement : Vercel, déploiement depuis GitHub
- Planificateur : Supabase pg_cron + pg_net qui appelle `/api/cron/publish` toutes les 5 minutes (Vercel Cron gratuit est limité à une fois par jour)
- Validation : Zod (formulaires et sorties de l'IA)
- IA : OpenAI, Anthropic ou Google, choisi par variable d'environnement, toujours derrière `lib/ai`

## Architecture
```
app/
  (app)/dashboard, clients, content, calendar, settings
  api/cron/publish        ← planificateur (protégé par CRON_SECRET)
  api/oauth/[network]     ← connexion et retour OAuth par réseau
lib/
  ai/                     ← generateStrategy, generateCalendar, generatePost, regeneratePost
  publishers/
    index.ts              ← interface commune publish(post) → { url, externalId } | { error }
    meta-facebook.ts
    meta-instagram.ts
    linkedin.ts
    x.ts
  crypto.ts               ← chiffrement AES-256 des jetons
  network-rules.ts        ← limites par réseau (longueur, médias obligatoires)
  i18n/                   ← textes de l'interface (fr, plus tard en)
supabase/migrations/      ← schéma SQL et règles RLS
docs/cahier-des-charges.md
```

Tables : `clients`, `social_accounts`, `strategies`, `posts`, `post_media`, `publish_logs`, `ai_generations`. Le détail des colonnes et des statuts est dans le cahier des charges, section 8.

## Règles non négociables
1. Multi-utilisateurs dès maintenant : chaque table principale a `owner_id`, et des règles RLS Supabase filtrent tout par `owner_id`. Jamais d'identifiant d'utilisateur codé en dur.
2. Sécurité des jetons : jetons OAuth chiffrés en base (`lib/crypto.ts`), jamais renvoyés au navigateur, jamais dans les logs.
3. Secrets : uniquement dans `.env.local` (jamais commité) et les variables d'environnement Vercel. Maintiens `.env.example` à jour, sans valeurs.
4. Appels externes côté serveur uniquement (API des réseaux et de l'IA).
5. Jamais de double publication : passer la publication en statut `publishing` (verrou) avant l'envoi ; pas de nouvelle tentative automatique, relance manuelle seulement.
6. Dates en UTC en base, affichées dans le fuseau du propriétaire (America/Toronto par défaut).
7. Ajouter un réseau = ajouter un fichier dans `lib/publishers/`, sans modifier le reste.
8. Toute sortie de l'IA est validée par un schéma Zod ; en cas d'échec, une seule relance avec l'erreur, puis un échec propre.
9. Textes de l'interface dans `lib/i18n/`, pas en dur dans les composants.

## Façon de travailler
- Travaille une phase à la fois, dans l'ordre du planning (cahier des charges, section 11). N'anticipe pas les phases suivantes.
- Avant de coder une phase, présente un plan court (fichiers créés ou modifiés, migrations) et attends ma validation.
- Après chaque phase : vérifie que `npm run build` et `npm run lint` passent, donne-moi les étapes pour tester à la main, puis propose un commit avec un message clair.
- Pour toute API externe (Meta, LinkedIn, X), vérifie la documentation officielle actuelle avant d'écrire l'adaptateur : les noms de permissions, les endpoints et les limites changent souvent. Signale-moi tout écart avec le cahier des charges.
- Quand une étape demande une action de ma part (créer une app développeur, ajouter une variable d'environnement, configurer une URL de retour OAuth), donne-moi des instructions pas à pas et attends que je confirme.
- Si une exigence est ambiguë, pose la question plutôt que deviner.

## Commandes
- `npm run dev` : serveur local (http://localhost:3000)
- `npm run build` : build de production
- `npm run lint` : vérification du code
- `npx supabase migration new <nom>` puis `npx supabase db push` : migrations
