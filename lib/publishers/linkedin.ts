import "server-only";
import { apiMessage, expiresAtFrom, form, http, readableError, requireEnv, truncate } from "./http";
import type { OAuthAccount, PublishAccount, PublishInput, PublishResult, Publisher, TokenSet } from "./types";

// LinkedIn : profils (Share on LinkedIn) et pages (Community Management API).
// LinkedIn impose une application distincte pour la Community Management API,
// d'où deux paires d'identifiants. À vérifier : version d'API, échappement du texte.
const API_VERSION = () => process.env.LINKEDIN_API_VERSION || "202610";
const LABEL = "LinkedIn";

function restHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": API_VERSION(),
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

// Format « little text » : les caractères réservés doivent être échappés,
// et les hashtags prennent la forme {hashtag|\#|mot}.
export function toLittleText(text: string): string {
  const escaped = text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  return escaped.replace(/\\#([\p{L}\p{N}]+)/gu, (_m, tag: string) => `{hashtag|\\#|${tag}}`);
}

async function exchangeCode(code: string, redirectUri: string, idVar: string, secretVar: string) {
  const res = await http("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: requireEnv(idVar),
      client_secret: requireEnv(secretVar),
    }),
  });
  const j = res.json as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string } | null;
  if (!res.ok || !j?.access_token) throw new Error(apiMessage(res.json, "échange du code refusé"));
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? null,
    expiresAt: expiresAtFrom(j.expires_in),
    scopes: (j.scope ?? "").split(/[ ,]+/).filter(Boolean),
  } satisfies TokenSet;
}

async function refreshToken(account: PublishAccount, idVar: string, secretVar: string): Promise<TokenSet> {
  const res = await http("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken ?? "",
      client_id: requireEnv(idVar),
      client_secret: requireEnv(secretVar),
    }),
  });
  const j = res.json as { access_token?: string; expires_in?: number; refresh_token?: string } | null;
  if (!res.ok || !j?.access_token) throw new Error(apiMessage(res.json, "renouvellement refusé"));
  return { accessToken: j.access_token, refreshToken: j.refresh_token ?? account.refreshToken, expiresAt: expiresAtFrom(j.expires_in) };
}

async function uploadImage(token: string, owner: string, media: PublishInput["media"][number]) {
  const init = await http("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: restHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const value = (init.json as { value?: { uploadUrl?: string; image?: string } })?.value;
  if (!init.ok || !value?.uploadUrl || !value.image) return { error: init };
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": media.mimeType },
    body: await media.bytes(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!put.ok) return { error: { status: put.status, json: null, text: await put.text(), ok: false, headers: put.headers } };
  return { urn: value.image };
}

async function publishAs(author: string, { text, media, account }: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const request: Record<string, unknown> = { author, mediaCount: media.length, textLength: text.length, version: API_VERSION() };

  const imageUrns: string[] = [];
  for (const m of media) {
    const up = await uploadImage(token, author, m);
    if ("error" in up && up.error) {
      const e = up.error;
      return { ok: false, error: readableError(LABEL, e.status, e.json, e.text), trace: { request, status: e.status, body: truncate(e.text) } };
    }
    if ("urn" in up && up.urn) imageUrns.push(up.urn);
  }

  const body: Record<string, unknown> = {
    author,
    commentary: toLittleText(text),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrns.length === 1) body.content = { media: { id: imageUrns[0] } };
  if (imageUrns.length > 1) body.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };

  const res = await http("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: restHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const trace = { request, status: res.status, body: truncate(res.text) };
  const postUrn = res.headers.get("x-restli-id");
  if (!res.ok || !postUrn) return { ok: false, error: readableError(LABEL, res.status, res.json, res.text), trace };
  return { ok: true, url: `https://www.linkedin.com/feed/update/${postUrn}/`, externalId: postUrn, trace };
}

const canRefresh = (account: PublishAccount) => Boolean(account.refreshToken);

// Profil personnel
const PERSON_SCOPES = ["openid", "profile", "w_member_social"];
export const linkedinPersonPublisher: Publisher = {
  network: "linkedin_person",
  requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  oauth: {
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: requireEnv("LINKEDIN_CLIENT_ID"),
        redirect_uri: redirectUri,
        state,
        scope: PERSON_SCOPES.join(" "),
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    },
    async exchange({ code, redirectUri }) {
      const tokens = await exchangeCode(code, redirectUri, "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET");
      const me = await http("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      const j = me.json as { sub?: string; name?: string } | null;
      if (!me.ok || !j?.sub) throw new Error(apiMessage(me.json, "lecture du profil impossible"));
      return [{ ...tokens, externalId: `urn:li:person:${j.sub}`, displayName: j.name ?? j.sub }];
    },
  },
  canRefresh,
  refresh: (account) => refreshToken(account, "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"),
  publish: (input) => publishAs(input.account.externalId, input),
};

// Page entreprise (nécessite l'accès Community Management approuvé par LinkedIn)
const PAGE_SCOPES = ["r_organization_social", "w_organization_social", "rw_organization_admin"];
export const linkedinPagePublisher: Publisher = {
  network: "linkedin_page",
  requiredEnv: ["LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET"],
  oauth: {
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: requireEnv("LINKEDIN_PAGES_CLIENT_ID"),
        redirect_uri: redirectUri,
        state,
        scope: PAGE_SCOPES.join(" "),
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    },
    async exchange({ code, redirectUri }) {
      const tokens = await exchangeCode(code, redirectUri, "LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET");
      const acls = await http(
        `https://api.linkedin.com/rest/organizationAcls?${new URLSearchParams({ q: "roleAssignee", role: "ADMINISTRATOR", state: "APPROVED" })}`,
        { headers: restHeaders(tokens.accessToken) },
      );
      if (!acls.ok) throw new Error(apiMessage(acls.json, "lecture des pages impossible"));
      const orgs = ((acls.json as { elements?: { organization?: string }[] })?.elements ?? [])
        .map((e) => e.organization)
        .filter((o): o is string => Boolean(o));
      const accounts: OAuthAccount[] = [];
      for (const urn of orgs) {
        const id = urn.split(":").pop();
        const org = await http(`https://api.linkedin.com/rest/organizations/${id}`, { headers: restHeaders(tokens.accessToken) });
        const name = (org.json as { localizedName?: string })?.localizedName ?? urn;
        accounts.push({ ...tokens, externalId: urn, displayName: name });
      }
      return accounts;
    },
  },
  canRefresh,
  refresh: (account) => refreshToken(account, "LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET"),
  publish: (input) => publishAs(input.account.externalId, input),
};
