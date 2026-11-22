"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-status";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { localToUtc } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";

// F-25 : glisser-déposer une publication sur une autre date
export async function movePostAction(postId: string, local: string): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  let date: Date;
  try {
    date = localToUtc(local, ctx.settings.timeZone);
  } catch {
    return { error: t.common.unknownError };
  }
  const { data: post } = await ctx.supabase.from("posts").select("status").eq("id", postId).maybeSingle();
  if (!post) return { error: t.common.notFound };
  // Une publication programmée déplacée dans le passé partirait immédiatement : refusé
  if (post.status === "scheduled" && date.getTime() < Date.now()) return { error: t.post.issues.pastDate };

  const { data } = await ctx.supabase
    .from("posts")
    .update({ scheduled_at: date.toISOString() })
    .eq("id", postId)
    .in("status", ["draft", "to_review", "scheduled", "failed"])
    .select("id");
  if (!data?.length) return { error: t.calendar.moveRefused };
  revalidatePath("/calendar");
  revalidatePath(`/content/${postId}`);
  return { ok: true, message: t.calendar.moved };
}
