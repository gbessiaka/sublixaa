import "server-only";
import { apiMessage, expiresAtFrom, form, http, readableError, requireEnv, truncate } from "./http";
import type { Publisher } from "./types";

// Comptes Instagram professionnels via « Instagram API with Instagram Login ».
// À vérifier dans la documentation Meta : version, permissions, limite de 50 publications / 24 h.
const VERSION = () => process.env.META_GRAPH_VERSION || "v24.0";
const GRAPH = () => `https://graph.instagram.com/${VERSION()}`;
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const LABEL = "Instagram";

async function waitForContainer(containerId: string, token: string): Promise<string | null> {
  // Le conteneur doit être prêt (FINISHED) avant publication
  for (let i = 0; i < 10; i++) {
    const res = await http(`${GRAPH()}/${containerId}?${new URLSearchParams({ fields: "status_code", access_token: token })}`);
    const status = (res.json as { status_code?: string })?.status_code;
    if (status === "FINISHED") return null;
    if (status === "ERROR" || status === "EXPIRED") return `${LABEL} : le média a été refusé (${status}).`;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return `${LABEL} : le média n'a pas été traité à temps.`;
}

export const instagramPublisher: Publisher = {
  network: "instagram",
  requiredEnv: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
  oauth: {
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: requireEnv("INSTAGRAM_APP_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(","),
        state,
      });
      return `https://www.instagram.com/oauth/authorize?${params}`;
    },
    async exchange({ code, redirectUri }) {
      const appId = requireEnv("INSTAGRAM_APP_ID");
      const secret = requireEnv("INSTAGRAM_APP_SECRET");
      const short = await http("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: form({ client_id: appId, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
      });
      // La réponse peut être { access_token } ou { data: [{ access_token }] } selon la version
      const sj = short.json as { access_token?: string; data?: { access_token?: string }[] } | null;
      const shortToken = sj?.access_token ?? sj?.data?.[0]?.access_token;
      if (!short.ok || !shortToken) throw new Error(apiMessage(short.json, "échange du code refusé"));

      const long = await http(
        `https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: secret, access_token: shortToken })}`,
      );
      const lj = long.json as { access_token?: string; expires_in?: number } | null;
      if (!long.ok || !lj?.access_token) throw new Error(apiMessage(long.json, "jeton longue durée refusé"));

      const me = await http(`${GRAPH()}/me?${new URLSearchParams({ fields: "user_id,username", access_token: lj.access_token })}`);
      const mj = me.json as { user_id?: string; id?: string; username?: string } | null;
      const igUserId = mj?.user_id ?? mj?.id;
      if (!me.ok || !igUserId) throw new Error(apiMessage(me.json, "lecture du compte impossible"));

      return [
        {
          externalId: String(igUserId),
          displayName: mj?.username ? `@${mj.username}` : String(igUserId),
          accessToken: lj.access_token,
          refreshToken: null,
          expiresAt: expiresAtFrom(lj.expires_in),
          scopes: SCOPES,
          metadata: { username: mj?.username ?? null },
        },
      ];
    },
  },
  // Jeton de 60 jours renouvelable tant qu'il est valide (et âgé d'au moins 24 h)
  canRefresh: (account) => !account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now(),
  async refresh(account) {
    const res = await http(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: account.accessToken })}`,
    );
    const j = res.json as { access_token?: string; expires_in?: number } | null;
    if (!res.ok || !j?.access_token) throw new Error(apiMessage(res.json, "renouvellement refusé"));
    return { accessToken: j.access_token, expiresAt: expiresAtFrom(j.expires_in) };
  },
  async publish({ text, media, account }) {
    const userId = account.externalId;
    const token = account.accessToken;
    const request: Record<string, unknown> = { igUserId: userId, mediaCount: media.length, textLength: text.length };
    if (media.length === 0) return { ok: false, error: `${LABEL} : une image est obligatoire.`, trace: { request } };

    let containerId: string | undefined;
    if (media.length === 1) {
      const res = await http(`${GRAPH()}/${userId}/media`, {
        method: "POST",
        body: form({ image_url: media[0].url, caption: text, access_token: token }),
      });
      containerId = (res.json as { id?: string })?.id;
      if (!res.ok || !containerId) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace: { request, status: res.status, body: truncate(res.text) } };
    } else {
      // Carrousel : un conteneur par image, puis un conteneur parent
      const children: string[] = [];
      for (const m of media) {
        const res = await http(`${GRAPH()}/${userId}/media`, {
          method: "POST",
          body: form({ image_url: m.url, is_carousel_item: "true", access_token: token }),
        });
        const id = (res.json as { id?: string })?.id;
        if (!res.ok || !id) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace: { request, status: res.status, body: truncate(res.text) } };
        children.push(id);
      }
      for (const id of children) {
        const waitError = await waitForContainer(id, token);
        if (waitError) return { ok: false, error: waitError, trace: { request } };
      }
      const res = await http(`${GRAPH()}/${userId}/media`, {
        method: "POST",
        body: form({ media_type: "CAROUSEL", children: children.join(","), caption: text, access_token: token }),
      });
      containerId = (res.json as { id?: string })?.id;
      if (!res.ok || !containerId) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace: { request, status: res.status, body: truncate(res.text) } };
    }

    const waitError = await waitForContainer(containerId, token);
    if (waitError) return { ok: false, error: waitError, trace: { request } };

    const pub = await http(`${GRAPH()}/${userId}/media_publish`, {
      method: "POST",
      body: form({ creation_id: containerId, access_token: token }),
    });
    const trace = { request, status: pub.status, body: truncate(pub.text) };
    const mediaId = (pub.json as { id?: string })?.id;
    if (!pub.ok || !mediaId) return { ok: false, error: readableError(LABEL, pub.status, pub.json, pub.text), trace };

    const link = await http(`${GRAPH()}/${mediaId}?${new URLSearchParams({ fields: "permalink", access_token: token })}`);
    const url = (link.json as { permalink?: string })?.permalink ?? "https://www.instagram.com/";
    return { ok: true, url, externalId: mediaId, trace };
  },
};
