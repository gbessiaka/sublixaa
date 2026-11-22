"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-status";
import { AiGenerationError, checkPostVersion, generateCalendar, generateStrategy } from "@/lib/ai";
import { buildAiContext } from "@/lib/ai/context";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { localToUtc, monthToDate } from "@/lib/dates";
import { splitList } from "@/lib/format";
import { getDictionary, interpolate } from "@/lib/i18n";
import { isNetworkId, normalizeHashtag } from "@/lib/network-rules";

// F-13 : générer la stratégie du mois
export async function generateStrategyAction(clientId: string, month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const networks = formData.getAll("networks").map(String).filter(isNetworkId);
  if (!networks.length) return { error: t.strategy.noNetworks };
  const monthlyGoal = String(formData.get("monthly_goal") ?? "").trim() || null;

  const ai = buildAiContext(ctx.supabase, ctx.user.id, ctx.settings);
  if (!ai) return { error: t.ai.notConfigured };
  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return { error: t.common.notFound };

  try {
    const output = await generateStrategy(ai, { client, month, networks, monthlyGoal });
    const frequency = Object.fromEntries(output.frequency.filter((f) => networks.includes(f.network as never)).map((f) => [f.network, f.per_week]));
    const { error } = await ctx.supabase.from("strategies").upsert(
      {
        owner_id: ctx.user.id,
        client_id: clientId,
        month: monthToDate(month),
        monthly_goal: monthlyGoal,
        pillars: output.pillars,
        frequency,
        theme_ideas: output.theme_ideas,
        status: "draft",
      },
      { onConflict: "client_id,month" },
    );
    if (error) return { error: t.common.unknownError };
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: interpolate(t.ai.failed, { message: error.message }) };
    throw error;
  }
  revalidatePath(`/clients/${clientId}/strategy`);
  return { ok: true, message: t.strategy.generated };
}

// F-14 : modifier la stratégie
export async function saveStrategyAction(strategyId: string, clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };

  const names = formData.getAll("pillar_name").map((v) => String(v).trim());
  const descriptions = formData.getAll("pillar_description").map((v) => String(v).trim());
  const shares = formData.getAll("pillar_share").map((v) => Number(v) || 0);
  const pillars = names
    .map((name, i) => ({ name, description: descriptions[i] ?? "", share: Math.max(0, Math.min(100, Math.round(shares[i] ?? 0))) }))
    .filter((p) => p.name);

  const frequency: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("freq_")) {
      const network = key.slice(5);
      if (isNetworkId(network)) frequency[network] = Math.max(0, Math.min(14, Math.round(Number(value) || 0)));
    }
  }
  const themeIdeas = splitList(formData.get("theme_ideas"), /\n/);
  const monthlyGoal = String(formData.get("monthly_goal") ?? "").trim() || null;

  const { error } = await ctx.supabase
    .from("strategies")
    .update({ pillars, frequency, theme_ideas: themeIdeas, monthly_goal: monthlyGoal })
    .eq("id", strategyId);
  if (error) return { error: t.common.unknownError };
  revalidatePath(`/clients/${clientId}/strategy`);
  return { ok: true, message: t.common.saved };
}

export async function setStrategyStatusAction(strategyId: string, clientId: string, status: "draft" | "validated") {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  await ctx.supabase.from("strategies").update({ status }).eq("id", strategyId);
  revalidatePath(`/clients/${clientId}/strategy`);
  revalidatePath(`/clients/${clientId}`);
}

// F-16 : générer le calendrier du mois à partir de la stratégie validée
export async function generateCalendarAction(strategyId: string, clientId: string, _prev: ActionState): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const ai = buildAiContext(ctx.supabase, ctx.user.id, ctx.settings);
  if (!ai) return { error: t.ai.notConfigured };

  const [{ data: strategy }, { data: client }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("strategies").select("*").eq("id", strategyId).maybeSingle(),
    ctx.supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    ctx.supabase.from("social_accounts").select("id, network, status").eq("client_id", clientId),
  ]);
  if (!strategy || !client) return { error: t.common.notFound };
  if (strategy.status !== "validated") return { error: t.strategy.mustValidate };

  const frequency = (strategy.frequency ?? {}) as Record<string, number>;
  const networks = Object.entries(frequency)
    .filter(([n, perWeek]) => isNetworkId(n) && perWeek > 0)
    .map(([n]) => n);
  if (!networks.length) return { error: t.strategy.noNetworks };
  const month = strategy.month.slice(0, 7);

  let output;
  try {
    output = await generateCalendar(ai, {
      client,
      month,
      timeZone: ctx.settings.timeZone,
      strategy,
      networks,
      strategyId,
    });
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: interpolate(t.ai.failed, { message: error.message }) };
    throw error;
  }

  // On écarte les publications qui restent hors limites après la relance
  const valid = output.posts.filter(
    (p) =>
      p.date.startsWith(month) &&
      networks.includes(p.network) &&
      checkPostVersion({ ...p, hashtags: p.hashtags.map(normalizeHashtag).filter(Boolean) }, client.words_to_avoid).length === 0,
  );
  const accountFor = (network: string) => accounts?.find((a) => a.network === network && a.status !== "expired")?.id ?? null;

  const rows = valid.map((p) => ({
    owner_id: ctx.user.id,
    client_id: clientId,
    strategy_id: strategyId,
    social_account_id: accountFor(p.network),
    network: p.network,
    pillar: p.pillar,
    topic: p.topic,
    body: p.body,
    hashtags: p.hashtags.map(normalizeHashtag).filter(Boolean),
    visual_idea: p.visual_idea,
    scheduled_at: localToUtc(p.date, ctx.settings.timeZone).toISOString(),
    status: "draft",
  }));
  if (rows.length) {
    const { error } = await ctx.supabase.from("posts").insert(rows);
    if (error) return { error: t.common.unknownError };
  }
  revalidatePath("/calendar");
  revalidatePath("/content");
  const rejected = output.posts.length - valid.length;
  if (rejected > 0) {
    return { ok: true, message: interpolate(t.strategy.calendarPartial, { count: String(rows.length), rejected: String(rejected) }) };
  }
  redirect(`/calendar?client=${clientId}&date=${month}-01`);
}
