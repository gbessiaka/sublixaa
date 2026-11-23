import "server-only";
import { NETWORK_RULES, isNetworkId, normalizeHashtag } from "@/lib/network-rules";
import { checkPostVersion } from "./checks";
import { buildSystemPrompt, type ClientProfile } from "./prompts";
import { runStructured, type AiContext } from "./run";
import {
  calendarSchema,
  postSchema,
  regenerateSchema,
  strategySchema,
  type CalendarOutput,
  type PostOutput,
  type RegenerateOutput,
  type StrategyOutput,
} from "./schemas";

export { AiGenerationError, type AiContext } from "./run";
export { checkPostVersion } from "./checks";
export type { CalendarOutput, PostOutput, RegenerateOutput, StrategyOutput } from "./schemas";

function cleanTags(tags: string[]) {
  return tags.map(normalizeHashtag).filter(Boolean);
}

// F-13 : stratégie mensuelle
export async function generateStrategy(
  ctx: AiContext,
  input: { client: ClientProfile; month: string; networks: string[]; monthlyGoal?: string | null },
): Promise<StrategyOutput> {
  const prompt = `Propose la stratégie de contenu du mois ${input.month} pour cette marque.
Réseaux à couvrir : ${input.networks.join(", ")}.
${input.monthlyGoal ? `Objectif particulier du mois : ${input.monthlyGoal}` : "Pas d'objectif particulier ce mois-ci."}

Format JSON attendu :
{
  "pillars": [{ "name": string, "description": string, "share": entier, pourcentage du contenu }],  // 3 à 5 piliers, total des parts = 100
  "frequency": [{ "network": string, "per_week": entier }],  // un élément par réseau listé ci-dessus
  "theme_ideas": [string]  // 10 à 20 idées de sujets concrets pour le mois
}
Choisis des fréquences réalistes pour une petite entreprise (souvent 2 à 4 publications par semaine).`;

  return runStructured(ctx, {
    kind: "strategy",
    system: buildSystemPrompt(input.client),
    prompt,
    schema: strategySchema,
    maxTokens: 8000,
    log: { clientId: input.client.id },
    check: (data) => {
      const errors: string[] = [];
      const total = data.pillars.reduce((s, p) => s + p.share, 0);
      if (total < 95 || total > 105) errors.push(`La somme des parts des piliers vaut ${total}, elle doit faire 100.`);
      for (const n of input.networks) {
        if (!data.frequency.some((f) => f.network === n)) errors.push(`Fréquence manquante pour le réseau ${n}.`);
      }
      return errors;
    },
  });
}

// F-16 : calendrier du mois à partir de la stratégie validée
export async function generateCalendar(
  ctx: AiContext,
  input: {
    client: ClientProfile;
    month: string;
    timeZone: string;
    strategy: { pillars: unknown; frequency: unknown; theme_ideas: unknown; monthly_goal: string | null };
    networks: string[];
    strategyId: string;
  },
): Promise<CalendarOutput> {
  const prompt = `Crée le calendrier de publications du mois ${input.month} (fuseau horaire ${input.timeZone}).

<strategie_validee>
${JSON.stringify({ objectif: input.strategy.monthly_goal, piliers: input.strategy.pillars, frequence_par_semaine: input.strategy.frequency, idees: input.strategy.theme_ideas }, null, 2)}
</strategie_validee>

Consignes :
- Respecte la fréquence hebdomadaire de chaque réseau sur tout le mois ; uniquement les réseaux : ${input.networks.join(", ")}.
- Répartis les piliers selon leurs parts et varie les sujets en t'appuyant sur les idées.
- Propose des heures de publication pertinentes pour chaque réseau (jours ouvrables pour LinkedIn), toutes dans le mois ${input.month}.
- Chaque publication est rédigée en entier, adaptée à son réseau.

Format JSON attendu :
{
  "posts": [{
    "date": "AAAA-MM-JJTHH:MM" (heure locale),
    "network": string,
    "pillar": string (nom exact d'un pilier),
    "topic": string (sujet en quelques mots),
    "body": string,
    "hashtags": [string],
    "visual_idea": string (idée de visuel à créer)
  }]
}`;

  return runStructured(ctx, {
    kind: "calendar",
    system: buildSystemPrompt(input.client),
    prompt,
    schema: calendarSchema,
    maxTokens: 20000,
    lenientLastAttempt: true,
    log: { clientId: input.client.id, strategyId: input.strategyId },
    check: (data) => {
      const errors: string[] = [];
      data.posts.forEach((p, i) => {
        if (!p.date.startsWith(input.month)) errors.push(`Publication ${i + 1} : la date ${p.date} n'est pas dans le mois ${input.month}.`);
        if (!input.networks.includes(p.network)) errors.push(`Publication ${i + 1} : réseau non prévu « ${p.network} ».`);
        errors.push(...checkPostVersion({ ...p, hashtags: cleanTags(p.hashtags) }, input.client.words_to_avoid, `Publication ${i + 1} (${p.network})`));
      });
      return errors;
    },
  });
}

// F-15 : une publication à partir d'un sujet libre, une version par réseau
export async function generatePost(
  ctx: AiContext,
  input: { client: ClientProfile; topic: string; networks: string[]; brief?: string | null },
): Promise<PostOutput> {
  const prompt = `Rédige une publication sur ce sujet :
<sujet>${input.topic}</sujet>
${input.brief ? `\n<consignes>\n${input.brief}\n</consignes>\n` : ""}
Une version adaptée pour chacun de ces réseaux : ${input.networks.join(", ")}.

Format JSON attendu :
{ "versions": [{ "network": string, "body": string, "hashtags": [string], "visual_idea": string }] }`;

  return runStructured(ctx, {
    kind: "post",
    system: buildSystemPrompt(input.client),
    prompt,
    schema: postSchema,
    maxTokens: 8000,
    log: { clientId: input.client.id },
    check: (data) => {
      const errors: string[] = [];
      for (const n of input.networks) {
        if (!data.versions.some((v) => v.network === n)) errors.push(`Version manquante pour ${n}.`);
      }
      data.versions.forEach((v) => errors.push(...checkPostVersion({ ...v, hashtags: cleanTags(v.hashtags) }, input.client.words_to_avoid)));
      return errors;
    },
  });
}

// F-17 : régénérer une publication avec une consigne libre (« plus court », « plus fun »)
export async function regeneratePost(
  ctx: AiContext,
  input: {
    client: ClientProfile;
    post: { id: string; network: string; topic: string | null; body: string; hashtags: string[] };
    instruction?: string | null;
  },
): Promise<RegenerateOutput> {
  const network = input.post.network;
  const rules = isNetworkId(network) ? NETWORK_RULES[network] : null;
  const prompt = `Réécris cette publication ${network}${input.post.topic ? ` (sujet : ${input.post.topic})` : ""}.
${input.instruction ? `Consigne : ${input.instruction}` : "Propose une nouvelle version, différente de la précédente."}

<publication_actuelle>
${input.post.body}
Hashtags : ${input.post.hashtags.join(" ")}
</publication_actuelle>
${rules ? `Limite : ${rules.maxLength} caractères hashtags compris.` : ""}

Format JSON attendu : { "body": string, "hashtags": [string] }`;

  return runStructured(ctx, {
    kind: "regenerate",
    system: buildSystemPrompt(input.client),
    prompt,
    schema: regenerateSchema,
    maxTokens: 4000,
    log: { clientId: input.client.id, postId: input.post.id },
    check: (data) => {
      const errors = checkPostVersion({ network, body: data.body, hashtags: cleanTags(data.hashtags) }, input.client.words_to_avoid);
      // « plus court » : le résultat doit réellement être plus court
      if (input.instruction && /court|bref|concis|short/i.test(input.instruction) && data.body.length >= input.post.body.length) {
        errors.push(`La nouvelle version (${data.body.length} caractères) n'est pas plus courte que l'actuelle (${input.post.body.length}).`);
      }
      return errors;
    },
  });
}
