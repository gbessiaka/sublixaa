"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiGenerationError, generatePost } from "@/lib/ai";
import { buildAiContext } from "@/lib/ai/context";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { localToUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { NETWORK_RULES, isNetworkId, normalizeHashtag, type NetworkId } from "@/lib/network-rules";

export type DraftResult = { ok: true; body: string; hashtags: string[] } | { ok: false; error: string };
export type CreateResult = { ok: true; ids: string[] } | { ok: false; error: string };

const TONES = ["client", "professional", "warm", "inspiring", "playful", "expert", "casual"] as const;

const draftSchema = z.object({
  clientId: z.uuid(),
  networks: z.array(z.string()).min(1),
  topic: z.string().trim().min(1).max(1000),
  link: z.string().trim().max(500).optional(),
  tone: z.enum(TONES),
  keywords: z.string().trim().max(500).optional(),
  details: z.string().trim().max(2000).optional(),
});

// Réseau le plus contraignant (texte le plus court) : la proposition doit convenir à tous les réseaux choisis
function strictestNetwork(networks: NetworkId[]): NetworkId {
  return [...networks].sort((a, b) => NETWORK_RULES[a].maxLength - NETWORK_RULES[b].maxLength)[0];
}

// F-15 : proposition de texte pour l'écran « Créer une publication », sans rien enregistrer
export async function draftTextAction(input: z.input<typeof draftSchema>): Promise<DraftResult> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { ok: false, error: t.auth.errors.forbidden };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.compose.errors.topicRequired };
  const { clientId, topic, link, tone, keywords, details } = parsed.data;
  const networks = parsed.data.networks.filter(isNetworkId);
  if (!networks.length) return { ok: false, error: t.strategy.noNetworks };

  const ai = buildAiContext(ctx.supabase, ctx.user.id, ctx.settings);
  if (!ai) return { ok: false, error: t.ai.notConfigured };
  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return { ok: false, error: t.common.notFound };

  const target = strictestNetwork(networks);
  const brief = [
    tone !== "client" ? `Ton souhaité : ${t.compose.tones[tone]}.` : null,
    keywords ? `Mots-clés à intégrer naturellement : ${keywords}.` : null,
    details ? `Précisions : ${details}` : null,
    link ? `Termine le texte en invitant à visiter ce lien : ${link}` : null,
    networks.length > 1 ? `Le même texte sera publié sur : ${networks.join(", ")}. Reste sous ${NETWORK_RULES[target].maxLength} caractères.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const output = await generatePost(ai, { client, topic, networks: [target], brief });
    const version = output.versions.find((v) => v.network === target) ?? output.versions[0];
    return { ok: true, body: version.body, hashtags: version.hashtags.map(normalizeHashtag).filter(Boolean) };
  } catch (error) {
    if (error instanceof AiGenerationError) return { ok: false, error: interpolate(t.ai.failed, { message: error.message }) };
    throw error;
  }
}

const createSchema = z.object({
  clientId: z.uuid(),
  networks: z.array(z.string()).min(1),
  topic: z.string().trim().max(1000).optional(),
  body: z.string().trim().min(1).max(63206),
  hashtags: z.array(z.string()).max(60),
  link: z.string().trim().max(500).optional(),
  scheduledLocal: z.string().optional(),
  status: z.enum(["draft", "to_review"]),
});

// Enregistre la publication : une ligne par réseau choisi (même texte, ajustable ensuite réseau par réseau)
export async function createPostsAction(input: z.input<typeof createSchema>): Promise<CreateResult> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { ok: false, error: t.auth.errors.forbidden };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.compose.errors.bodyRequired };
  const { clientId, topic, hashtags, link, scheduledLocal, status } = parsed.data;
  const networks = parsed.data.networks.filter(isNetworkId);
  if (!networks.length) return { ok: false, error: t.strategy.noNetworks };

  // Le lien est ajouté à la fin du texte s'il n'y figure pas déjà
  const body = link && !parsed.data.body.includes(link) ? `${parsed.data.body}\n\n${link}` : parsed.data.body;

  let scheduledAt: string | null = null;
  if (scheduledLocal) {
    try {
      scheduledAt = localToUtc(scheduledLocal, ctx.settings.timeZone).toISOString();
    } catch {
      return { ok: false, error: t.compose.errors.date };
    }
  }

  const [{ data: client }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("clients").select("id").eq("id", clientId).maybeSingle(),
    ctx.supabase.from("social_accounts").select("id, network, status").eq("client_id", clientId),
  ]);
  if (!client) return { ok: false, error: t.common.notFound };

  const tags = hashtags.map(normalizeHashtag).filter(Boolean);
  const rows = networks.map((network) => ({
    owner_id: ctx.user.id,
    client_id: clientId,
    social_account_id: accounts?.find((a) => a.network === network && a.status !== "expired")?.id ?? null,
    network,
    topic: topic || null,
    body,
    hashtags: tags,
    scheduled_at: scheduledAt,
    status,
  }));
  const { data: inserted, error } = await ctx.supabase.from("posts").insert(rows).select("id");
  if (error || !inserted) return { ok: false, error: t.common.unknownError };
  revalidatePath("/content");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true, ids: inserted.map((r) => r.id) };
}
