"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-status";
import { AiGenerationError, regeneratePost } from "@/lib/ai";
import { buildAiContext } from "@/lib/ai/context";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { localToUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { getRules, normalizeHashtag } from "@/lib/network-rules";
import { schedulingIssues } from "@/lib/post-validation";
import { EDITABLE_STATUSES, MANUAL_TRANSITIONS } from "@/lib/posts";
import { publishPost } from "@/lib/publishing";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidate(postId: string) {
  revalidatePath(`/content/${postId}`);
  revalidatePath("/content");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// F-18 : modification manuelle du texte, des hashtags, de la date et du compte
export async function savePostAction(postId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const scheduled = String(formData.get("scheduled_at") ?? "");
  const accountId = String(formData.get("social_account_id") ?? "");
  const update = {
    body: String(formData.get("body") ?? "").slice(0, 70000),
    hashtags: String(formData.get("hashtags") ?? "")
      .split(/[\s,]+/)
      .map(normalizeHashtag)
      .filter(Boolean),
    topic: String(formData.get("topic") ?? "").trim() || null,
    visual_idea: String(formData.get("visual_idea") ?? "").trim() || null,
    scheduled_at: scheduled ? localToUtc(scheduled, ctx.settings.timeZone).toISOString() : null,
    social_account_id: accountId || null,
  };
  const { data, error } = await ctx.supabase
    .from("posts")
    .update(update)
    .eq("id", postId)
    .in("status", [...EDITABLE_STATUSES])
    .select("*")
    .maybeSingle();
  if (error) return { error: t.common.unknownError };
  if (!data) return { error: t.post.errors.invalidTransition };

  // Une publication programmée qui ne respecte plus les règles repasse en brouillon
  if (data.status === "scheduled") {
    const issues = await schedulingIssues(ctx.supabase, data, { requireDate: true });
    if (issues.length) {
      await ctx.supabase.from("posts").update({ status: "draft" }).eq("id", postId);
      revalidate(postId);
      return { error: issues.join(" ") };
    }
  }
  revalidate(postId);
  return { ok: true, message: t.common.saved };
}

// F-17 : régénérer avec une consigne libre
export async function regeneratePostAction(postId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const ai = buildAiContext(ctx.supabase, ctx.user.id, ctx.settings);
  if (!ai) return { error: t.ai.notConfigured };
  const { data: post } = await ctx.supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) return { error: t.common.notFound };
  if (!EDITABLE_STATUSES.includes(post.status as never)) return { error: t.post.errors.invalidTransition };
  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", post.client_id).maybeSingle();
  if (!client) return { error: t.common.notFound };

  const instruction = String(formData.get("instruction") ?? "").trim().slice(0, 500) || null;
  try {
    const output = await regeneratePost(ai, { client, post, instruction });
    await ctx.supabase
      .from("posts")
      .update({ body: output.body, hashtags: output.hashtags.map(normalizeHashtag).filter(Boolean) })
      .eq("id", postId);
  } catch (error) {
    if (error instanceof AiGenerationError) return { error: interpolate(t.ai.failed, { message: error.message }) };
    throw error;
  }
  revalidate(postId);
  return { ok: true, message: t.post.regenerated };
}

// Changements de statut manuels (à valider, programmer, déprogrammer, réessayer, publié manuellement)
export async function transitionPostAction(
  postId: string,
  transition: keyof typeof MANUAL_TRANSITIONS,
  _prev: ActionState,
): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const rule = MANUAL_TRANSITIONS[transition];
  const { data: post } = await ctx.supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) return { error: t.common.notFound };
  if (!rule.from.includes(post.status as never)) return { error: t.post.errors.invalidTransition };

  const rules = getRules(post.network);
  const update: { status: string; scheduled_at?: string; published_at?: string; error_message?: null } = { status: rule.to };

  if (rule.to === "scheduled") {
    // Règle de validation : pas de programmation si une limite n'est pas respectée
    const issues = await schedulingIssues(ctx.supabase, post, { requireDate: transition !== "retry" });
    if (issues.length) return { error: issues.join(" ") };
    // F-31 : « Réessayer » repasse en programmé ; si la date est passée, le planificateur l'envoie au prochain passage
    if (transition === "retry" && (!post.scheduled_at || new Date(post.scheduled_at) < new Date())) {
      update.scheduled_at = new Date().toISOString();
    }
    update.error_message = null;
  }
  if (rule.to === "published_manually") {
    if (rules?.autoPublish) return { error: t.post.errors.invalidTransition };
    update.published_at = new Date().toISOString();
  }

  const { data } = await ctx.supabase
    .from("posts")
    .update(update)
    .eq("id", postId)
    .in("status", [...rule.from])
    .select("id");
  if (!data?.length) return { error: t.post.errors.invalidTransition };
  revalidate(postId);
  return { ok: true, message: rule.to === "scheduled" ? t.post.scheduled : t.common.saved };
}

// F-29 : publication immédiate (verrou « publishing » posé par publishPost)
export async function publishNowAction(postId: string, _prev: ActionState): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const { data: post } = await ctx.supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) return { error: t.common.notFound };
  const issues = await schedulingIssues(ctx.supabase, post, { requireDate: false });
  if (issues.length) return { error: issues.join(" ") };

  const outcome = await publishPost(createAdminClient(), {
    postId,
    ownerId: ctx.user.id,
    allowedFrom: ["draft", "to_review", "scheduled", "failed"],
  });
  revalidate(postId);
  if (outcome.ok) return { ok: true, message: t.post.published };
  if ("skipped" in outcome) return { error: t.post.errors.invalidTransition };
  return { error: interpolate(t.post.publishFailed, { message: outcome.error }) };
}

export async function deletePostAction(postId: string) {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  const { data: media } = await ctx.supabase.from("post_media").select("storage_path").eq("post_id", postId);
  const { data } = await ctx.supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .in("status", ["draft", "to_review", "scheduled", "failed", "published", "published_manually"])
    .select("id");
  if (data?.length && media?.length) {
    await ctx.supabase.storage.from("post-media").remove(media.map((m) => m.storage_path));
  }
  revalidatePath("/content");
  revalidatePath("/calendar");
  redirect("/content");
}

// F-20 : enregistre une image déjà envoyée dans le stockage par le navigateur
export async function registerMediaAction(
  postId: string,
  media: { storagePath: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null },
): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  // Le fichier doit être dans le dossier du propriétaire et de cette publication
  if (!media.storagePath.startsWith(`${ctx.user.id}/${postId}/`)) return { error: t.post.errors.upload };
  if (!["image/jpeg", "image/png"].includes(media.mimeType)) return { error: t.post.errors.upload };
  const { data: post } = await ctx.supabase.from("posts").select("id, status").eq("id", postId).maybeSingle();
  if (!post || !EDITABLE_STATUSES.includes(post.status as never)) return { error: t.post.errors.invalidTransition };
  const { count } = await ctx.supabase.from("post_media").select("id", { count: "exact", head: true }).eq("post_id", postId);
  const { error } = await ctx.supabase.from("post_media").insert({
    post_id: postId,
    storage_path: media.storagePath,
    mime_type: media.mimeType,
    size_bytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    position: count ?? 0,
  });
  if (error) return { error: t.post.errors.upload };
  revalidate(postId);
  return { ok: true };
}

export async function removeMediaAction(postId: string, mediaId: string) {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  const { data } = await ctx.supabase.from("post_media").delete().eq("id", mediaId).select("storage_path");
  if (data?.[0]) await ctx.supabase.storage.from("post-media").remove([data[0].storage_path]);
  revalidate(postId);
}
