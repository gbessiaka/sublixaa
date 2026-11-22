import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/crypto";

// État OAuth (anti-CSRF) et vérificateur PKCE, conservés dans un cookie chiffré de 10 minutes
const COOKIE = "oauth_state";

type OAuthState = { state: string; verifier: string; clientId: string; network: string; exp: number };

export function newOAuthState(clientId: string, network: string) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { data: { state, verifier, clientId, network, exp: Date.now() + 10 * 60 * 1000 }, challenge };
}

export async function saveOAuthState(data: OAuthState) {
  const store = await cookies();
  store.set(COOKIE, encrypt(JSON.stringify(data)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth",
    maxAge: 600,
  });
}

// Lit et efface l'état ; null s'il est absent, expiré ou ne correspond pas
export async function consumeOAuthState(network: string, state: string | null): Promise<OAuthState | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  store.delete({ name: COOKIE, path: "/api/oauth" });
  if (!raw || !state) return null;
  try {
    const data = JSON.parse(decrypt(raw)) as OAuthState;
    if (data.state !== state || data.network !== network || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
