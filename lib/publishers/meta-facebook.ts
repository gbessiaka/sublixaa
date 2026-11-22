import "server-only";
import { apiMessage, form, http, readableError, requireEnv, truncate } from "./http";
import type { OAuthAccount, Publisher } from "./types";

// Pages Facebook via la Graph API (Facebook Login).
// À vérifier dans la documentation Meta : version de l'API, noms des permissions.
const VERSION = () => process.env.META_GRAPH_VERSION || "v24.0";
const GRAPH = () => `https://graph.facebook.com/${VERSION()}`;
const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
const LABEL = "Facebook";

export const facebookPublisher: Publisher = {
  network: "facebook",
  requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
  oauth: {
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: requireEnv("META_APP_ID"),
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        scope: SCOPES.join(","),
      });
      return `https://www.facebook.com/${VERSION()}/dialog/oauth?${params}`;
    },
    async exchange({ code, redirectUri }) {
      const appId = requireEnv("META_APP_ID");
      const secret = requireEnv("META_APP_SECRET");
      // 1. Code -> jeton utilisateur de courte durée
      const short = await http(
        `${GRAPH()}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirectUri, code })}`,
      );
      const shortToken = (short.json as { access_token?: string })?.access_token;
      if (!short.ok || !shortToken) throw new Error(apiMessage(short.json, "échange du code refusé"));
      // 2. Jeton utilisateur de longue durée : les jetons de page qui en dérivent n'expirent pas
      const long = await http(
        `${GRAPH()}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: shortToken })}`,
      );
      const userToken = (long.json as { access_token?: string })?.access_token ?? shortToken;
      // 3. Pages gérées et leurs jetons
      const pages = await http(
        `${GRAPH()}/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,tasks", limit: "100", access_token: userToken })}`,
      );
      if (!pages.ok) throw new Error(apiMessage(pages.json, "lecture des pages impossible"));
      const data = ((pages.json as { data?: { id: string; name: string; access_token: string; tasks?: string[] }[] })?.data ?? []);
      return data.map<OAuthAccount>((p) => ({
        externalId: p.id,
        displayName: p.name,
        accessToken: p.access_token,
        refreshToken: null,
        expiresAt: null,
        scopes: SCOPES,
        metadata: { tasks: p.tasks ?? [] },
      }));
    },
  },
  canRefresh: () => false,
  async publish({ text, media, account }) {
    const pageId = account.externalId;
    const token = account.accessToken;
    const request: Record<string, unknown> = { pageId, mediaCount: media.length, textLength: text.length };

    let res;
    if (media.length === 0) {
      res = await http(`${GRAPH()}/${pageId}/feed`, { method: "POST", body: form({ message: text, access_token: token }) });
    } else if (media.length === 1) {
      res = await http(`${GRAPH()}/${pageId}/photos`, {
        method: "POST",
        body: form({ url: media[0].url, message: text, access_token: token }),
      });
    } else {
      // Plusieurs images : envoi non publié puis publication groupée
      const ids: string[] = [];
      for (const m of media) {
        const up = await http(`${GRAPH()}/${pageId}/photos`, {
          method: "POST",
          body: form({ url: m.url, published: "false", access_token: token }),
        });
        const id = (up.json as { id?: string })?.id;
        if (!up.ok || !id) {
          return { ok: false, error: readableError(LABEL, up.status, up.json, up.text), trace: { request, status: up.status, body: truncate(up.text) } };
        }
        ids.push(id);
      }
      const body: Record<string, string> = { message: text, access_token: token };
      ids.forEach((id, i) => (body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
      res = await http(`${GRAPH()}/${pageId}/feed`, { method: "POST", body: form(body) });
    }

    const trace = { request, status: res.status, body: truncate(res.text) };
    const json = res.json as { id?: string; post_id?: string } | null;
    const postId = json?.post_id ?? json?.id;
    if (!res.ok || !postId) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace };

    // Lien public de la publication
    const link = await http(`${GRAPH()}/${postId}?${new URLSearchParams({ fields: "permalink_url", access_token: token })}`);
    const url = (link.json as { permalink_url?: string })?.permalink_url ?? `https://www.facebook.com/${postId}`;
    return { ok: true, url, externalId: postId, trace };
  },
};
