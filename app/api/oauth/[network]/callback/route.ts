import { NextResponse, type NextRequest } from "next/server";
import { saveAccount } from "@/lib/accounts";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { encrypt, encryptOptional } from "@/lib/crypto";
import { consumeOAuthState } from "@/lib/oauth-state";
import { getPublisher } from "@/lib/publishers";
import { oauthRedirectUri } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Retour OAuth : échange du code, puis enregistrement du compte (ou choix parmi plusieurs pages)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/oauth/[network]/callback">) {
  const { network } = await params;
  const sp = request.nextUrl.searchParams;
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));

  const saved = await consumeOAuthState(network, sp.get("state"));
  const fallback = new URL("/clients", request.url);
  if (!saved) {
    fallback.searchParams.set("oauth_error", "state");
    return NextResponse.redirect(fallback);
  }
  const back = new URL(`/clients/${saved.clientId}`, request.url);
  const code = sp.get("code");
  if (sp.get("error") || !code) {
    back.searchParams.set("oauth_error", "denied");
    return NextResponse.redirect(back);
  }

  const publisher = getPublisher(network);
  if (!publisher) return NextResponse.redirect(back);

  try {
    const accounts = await publisher.oauth.exchange({
      code,
      redirectUri: await oauthRedirectUri(network),
      codeVerifier: saved.verifier,
    });
    const admin = createAdminClient();
    if (accounts.length === 0) {
      back.searchParams.set("oauth_error", "no_accounts");
      return NextResponse.redirect(back);
    }
    if (accounts.length === 1) {
      await saveAccount(admin, ctx.user.id, saved.clientId, network, accounts[0]);
      back.searchParams.set("connected", network);
      return NextResponse.redirect(back);
    }
    // Plusieurs comptes (ex. pages Facebook) : on les met en attente pour que le propriétaire choisisse
    await admin.from("oauth_candidates").delete().eq("owner_id", ctx.user.id);
    await admin.from("oauth_candidates").insert(
      accounts.map((a) => ({
        owner_id: ctx.user.id,
        client_id: saved.clientId,
        network,
        external_id: a.externalId,
        display_name: a.displayName,
        access_token_enc: encrypt(a.accessToken),
        refresh_token_enc: encryptOptional(a.refreshToken),
        token_expires_at: a.expiresAt?.toISOString() ?? null,
        scopes: a.scopes ?? [],
        metadata: (a.metadata ?? {}) as { [key: string]: Json },
      })),
    );
    return NextResponse.redirect(new URL(`/clients/${saved.clientId}/accounts/select?network=${network}`, request.url));
  } catch (error) {
    // Message de la plateforme, sans jeton (les jetons ne sont jamais inclus dans les erreurs)
    back.searchParams.set("oauth_error", "exchange");
    back.searchParams.set("message", (error instanceof Error ? error.message : "").slice(0, 200));
    return NextResponse.redirect(back);
  }
}
