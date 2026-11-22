import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { publishPost } from "@/lib/publishing";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// F-28 : appelé toutes les 5 minutes par pg_cron ; publie les publications programmées
// dont l'heure est passée. Chaque publication est verrouillée avant l'envoi (règle 5).
async function handle(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("posts")
    .select("id, owner_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(20);

  const results = { due: due?.length ?? 0, published: 0, failed: 0, skipped: 0 };
  for (const post of due ?? []) {
    const outcome = await publishPost(admin, { postId: post.id, ownerId: post.owner_id, allowedFrom: ["scheduled"] });
    if (outcome.ok) results.published++;
    else if ("skipped" in outcome) results.skipped++;
    else results.failed++;
  }
  return NextResponse.json(results);
}

export const GET = handle;
export const POST = handle;
