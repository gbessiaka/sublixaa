import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { newOAuthState, saveOAuthState } from "@/lib/oauth-state";
import { getPublisher, isPublisherConfigured } from "@/lib/publishers";
import { oauthRedirectUri } from "@/lib/site";

// Démarre la connexion d'un compte social pour un client (F-09)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/oauth/[network]">) {
  const { network } = await params;
  const clientId = request.nextUrl.searchParams.get("clientId") ?? "";
  const back = new URL(`/clients/${clientId}`, request.url);

  const ctx = await getOwnerContextOrNull();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));

  const publisher = getPublisher(network);
  if (!publisher || !isPublisherConfigured(publisher)) {
    back.searchParams.set("oauth_error", "not_configured");
    back.searchParams.set("network", network);
    return NextResponse.redirect(back);
  }
  // Le client doit appartenir au propriétaire (RLS)
  const { data: client } = await ctx.supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.redirect(new URL("/clients", request.url));

  const { data, challenge } = newOAuthState(clientId, network);
  await saveOAuthState(data);
  const url = publisher.oauth.authorizeUrl({
    state: data.state,
    redirectUri: await oauthRedirectUri(network),
    codeChallenge: publisher.oauth.usesPkce ? challenge : undefined,
  });
  return NextResponse.redirect(url);
}
