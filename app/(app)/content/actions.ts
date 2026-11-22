"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-status";
import { AiGenerationError, generatePost } from "@/lib/ai";
import { buildAiContext } from "@/lib/ai/context";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { getDictionary, interpolate } from "@/lib/i18n";
import { isNetworkId, normalizeHashtag } from "@/lib/network-rules";
import { schedulingIssues } from "@/lib/post-validation";

// F-15 : générer une publication à partir d'un sujet libre, une version par réseau
export async function generatePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const clientId = String(formData.get("client_id") ?? "");
  const topic = String(formData.get("topic") ?? "").trim().slice(0, 1000);
  const networks = formData.getAll("networks").map(String).filter(isNetworkId);
  if (!clientId || !topic) return { error: t.common.unknownError };
  if (!networks.length) return { error: t.strategy.noNetworks };

  const ai = buildAiContext(ctx.supabase, ctx.user.id, ctx.settings);
  if (!ai) return { error: t.ai.notConfigured };
  const [{ data: client }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    ctx.supabase.from("social_accounts").select("id, network, status").eq("client_id", clientId),
  ]);
  if (!client) return { error: t.common.notFound };

  let output;
  try {
    output = await generatePost(ai, { client, topic, networks });
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: interpolate(t.ai.failed, { message: error.message }) };
    throw error;
  }
  const rows = output.versions
    .filter((v) => networks.includes(v.network as never))
    .map((v) => ({
      owner_id: ctx.user.id,
      client_id: clientId,
      social_account_id: accounts?.find((a) => a.network === v.network && a.status !== "expired")?.id ?? null,
      network: v.network,
      topic,
      body: v.body,
      hashtags: v.hashtags.map(normalizeHashtag).filter(Boolean),
      visual_idea: v.visual_idea,
      status: "draft",
    }));
  const { data: inserted, error } = await ctx.supabase.from("posts").insert(rows).select("id");
  if (error) return { error: t.common.unknownError };
  revalidatePath("/content");
  if (inserted?.length === 1) redirect(`/content/${inserted[0].id}`);
  return { ok: true, message: interpolate(t.content.generatedCount, { count: String(inserted?.length ?? 0) }) };
}

// F-27 : programmer plusieurs publications d'un coup
export async function scheduleManyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const ids = formData.getAll("post_id").map(String);
  const { data: posts } = await ctx.supabase.from("posts").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  let ok = 0;
  let ko = 0;
  for (const post of posts ?? []) {
    if (!["draft", "to_review"].includes(post.status)) {
      ko++;
      continue;
    }
    const issues = await schedulingIssues(ctx.supabase, post, { requireDate: true });
    if (issues.length) {
      ko++;
      continue;
    }
    const { data } = await ctx.supabase
      .from("posts")
      .update({ status: "scheduled" })
      .eq("id", post.id)
      .in("status", ["draft", "to_review"])
      .select("id");
    if (data?.length) ok++;
    else ko++;
  }
  revalidatePath("/content");
  revalidatePath("/calendar");
  return { ok: true, message: interpolate(t.content.scheduleResult, { ok: String(ok), ko: String(ko) }) };
}
