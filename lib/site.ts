import "server-only";
import { headers } from "next/headers";

// URL publique du site (liens magiques, URL de retour OAuth)
export async function getSiteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function oauthRedirectUri(network: string): Promise<string> {
  return `${await getSiteUrl()}/api/oauth/${network}/callback`;
}
