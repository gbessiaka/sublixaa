"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeStatus } from "@/lib/accounts";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { getPublisher } from "@/lib/publishers";
import { createAdminClient } from "@/lib/supabase/admin";

// F-12 : déconnecter un compte supprime la ligne et donc son jeton chiffré
export async function disconnectAccountAction(accountId: string, clientId: string) {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  await ctx.supabase.from("social_accounts").delete().eq("id", accountId);
  revalidatePath(`/clients/${clientId}`);
}

// Rattache les comptes choisis parmi ceux proposés après l'autorisation OAuth
export async function selectCandidatesAction(clientId: string, formData: FormData) {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  const chosen = formData.getAll("candidate").map(String);
  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("oauth_candidates")
    .select("*")
    .eq("owner_id", ctx.user.id)
    .eq("client_id", clientId)
    .in("id", chosen.length ? chosen : ["00000000-0000-0000-0000-000000000000"]);

  for (const c of candidates ?? []) {
    const publisher = getPublisher(c.network);
    const expiresAt = c.token_expires_at ? new Date(c.token_expires_at) : null;
    await admin.from("social_accounts").upsert(
      {
        owner_id: ctx.user.id,
        client_id: clientId,
        network: c.network,
        external_id: c.external_id,
        display_name: c.display_name,
        access_token_enc: c.access_token_enc,
        refresh_token_enc: c.refresh_token_enc,
        token_expires_at: c.token_expires_at,
        scopes: c.scopes,
        metadata: c.metadata,
        status: computeStatus(expiresAt, Boolean(publisher?.refresh && c.refresh_token_enc)),
      },
      { onConflict: "client_id,network,external_id" },
    );
  }
  // Les comptes non choisis (et leurs jetons) sont supprimés
  await admin.from("oauth_candidates").delete().eq("owner_id", ctx.user.id);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?connected=1`);
}
