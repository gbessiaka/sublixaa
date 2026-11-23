"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-status";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { getDictionary, interpolate } from "@/lib/i18n";
import { schedulingIssues } from "@/lib/post-validation";

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
