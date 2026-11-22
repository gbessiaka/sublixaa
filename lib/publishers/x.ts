import "server-only";
import { apiMessage, expiresAtFrom, form, http, readableError, requireEnv, truncate } from "./http";
import type { Publisher, TokenSet } from "./types";

// X (API v2, OAuth 2.0 avec PKCE). Paiement à l'usage : chaque publication est facturée.
// À vérifier dans la documentation X : envoi des médias en v2, portées.
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];
const LABEL = "X";

function basicAuth() {
  const id = requireEnv("X_CLIENT_ID");
  const secret = requireEnv("X_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await http("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ ...body, client_id: requireEnv("X_CLIENT_ID") }),
  });
  const j = res.json as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string } | null;
  if (!res.ok || !j?.access_token) throw new Error(apiMessage(res.json, "jeton refusé"));
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? null,
    expiresAt: expiresAtFrom(j.expires_in),
    scopes: (j.scope ?? "").split(" ").filter(Boolean),
  };
}

export const xPublisher: Publisher = {
  network: "x",
  requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  oauth: {
    usesPkce: true,
    authorizeUrl({ state, redirectUri, codeChallenge }) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: requireEnv("X_CLIENT_ID"),
        redirect_uri: redirectUri,
        scope: SCOPES.join(" "),
        state,
        code_challenge: codeChallenge ?? "",
        code_challenge_method: "S256",
      });
      return `https://x.com/i/oauth2/authorize?${params}`;
    },
    async exchange({ code, redirectUri, codeVerifier }) {
      const tokens = await tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier ?? "",
      });
      const me = await http("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      const u = (me.json as { data?: { id: string; name: string; username: string } })?.data;
      if (!me.ok || !u) throw new Error(apiMessage(me.json, "lecture du compte impossible"));
      return [{ ...tokens, externalId: u.id, displayName: `@${u.username}`, metadata: { username: u.username } }];
    },
  },
  // Jeton d'accès de 2 h renouvelé grâce au jeton de rafraîchissement (offline.access)
  canRefresh: (account) => Boolean(account.refreshToken),
  async refresh(account) {
    return tokenRequest({ grant_type: "refresh_token", refresh_token: account.refreshToken ?? "" });
  },
  async publish({ text, media, account }) {
    const token = account.accessToken;
    const request: Record<string, unknown> = { userId: account.externalId, mediaCount: media.length, textLength: text.length };

    const mediaIds: string[] = [];
    for (const m of media) {
      const body = new FormData();
      body.append("media", new Blob([await m.bytes()], { type: m.mimeType }));
      body.append("media_category", "tweet_image");
      const up = await http("https://api.x.com/2/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }, 60_000);
      const id = (up.json as { data?: { id?: string } })?.data?.id;
      if (!up.ok || !id) return { ok: false, error: readableError(LABEL, up.status, up.json, up.text), trace: { request, status: up.status, body: truncate(up.text) } };
      mediaIds.push(id);
    }

    const res = await http("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(mediaIds.length ? { text, media: { media_ids: mediaIds } } : { text }),
    });
    const trace = { request, status: res.status, body: truncate(res.text) };
    const id = (res.json as { data?: { id?: string } })?.data?.id;
    if (!res.ok || !id) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace };
    const username = (account.metadata.username as string | undefined) ?? "i";
    return { ok: true, url: `https://x.com/${username}/status/${id}`, externalId: id, trace };
  },
};
