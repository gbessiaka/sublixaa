import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { issueMessage } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getRules, validatePost } from "@/lib/network-rules";
import type { Database, Tables } from "@/lib/supabase/database.types";

// Problèmes empêchant de programmer (ou publier) une publication (cahier, section 4)
export async function schedulingIssues(
  supabase: SupabaseClient<Database>,
  post: Tables<"posts">,
  options: { requireDate: boolean },
): Promise<string[]> {
  const t = getDictionary().post.issues;
  const { data: media } = await supabase.from("post_media").select("mime_type, size_bytes").eq("post_id", post.id);
  const issues = validatePost(post.network, post.body, post.hashtags, media ?? []).map((i) => issueMessage(t, i));
  const rules = getRules(post.network);
  if (rules && !rules.autoPublish) issues.push(t.manualNetwork);
  if (options.requireDate && !post.scheduled_at) issues.push(t.noDate);
  if (rules?.autoPublish && !post.social_account_id) issues.push(t.noAccount);
  return issues;
}
