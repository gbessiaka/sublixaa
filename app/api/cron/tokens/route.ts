import { NextResponse } from "next/server";
import { refreshAllAccounts } from "@/lib/accounts";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// F-10, F-11 : tâche quotidienne de renouvellement des jetons et de mise à jour des états
async function handle(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await refreshAllAccounts(createAdminClient());
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
