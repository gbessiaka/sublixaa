import "server-only";

export type HttpResult = { status: number; ok: boolean; headers: Headers; text: string; json: unknown };

// Requête HTTP vers une API externe, avec délai maximal ; ne lève pas d'exception sur un code d'erreur
export async function http(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<HttpResult> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, headers: response.headers, text, json };
}

export function form(data: Record<string, string>): URLSearchParams {
  return new URLSearchParams(data);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

// Extrait un message d'erreur lisible d'une réponse d'API
export function apiMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      if (typeof e.error_user_msg === "string") return e.error_user_msg;
      if (typeof e.message === "string") return e.message;
    }
    if (typeof err === "string") return typeof o.error_description === "string" ? o.error_description : err;
    if (typeof o.message === "string") return o.message;
    if (typeof o.detail === "string") return o.detail;
    if (Array.isArray(o.errors) && o.errors[0] && typeof o.errors[0] === "object") {
      const first = o.errors[0] as Record<string, unknown>;
      if (typeof first.message === "string") return first.message;
    }
  }
  return fallback;
}

// Message d'échec lisible en français (F-31)
export function readableError(networkLabel: string, status: number, json: unknown, text: string): string {
  const detail = apiMessage(json, text.slice(0, 300) || `code ${status}`);
  if (status === 401) return `${networkLabel} : jeton expiré ou révoqué. Reconnectez le compte. (${detail})`;
  if (status === 403) return `${networkLabel} : permission refusée. (${detail})`;
  if (status === 429) return `${networkLabel} : limite de publications atteinte, réessayez plus tard. (${detail})`;
  if (status >= 500) return `${networkLabel} : la plateforme est indisponible (code ${status}). (${detail})`;
  return `${networkLabel} : ${detail}`;
}

// Tronque une réponse avant de la journaliser
export function truncate(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function expiresAtFrom(seconds: unknown): Date | null {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 1000) : null;
}
