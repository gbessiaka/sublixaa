"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/auth/allowed";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; message?: string; email?: string } | undefined;

const loginSchema = z.object({
  intent: z.enum(["password", "magic"]),
  email: z.email(),
  password: z.string().optional(),
});

const RATE_LIMIT_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

// URL publique du site, pour le lien magique (doit figurer dans les Redirect URLs de Supabase)
async function getSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = getDictionary().auth;
  const parsed = loginSchema.safeParse({
    intent: formData.get("intent"),
    email: formData.get("email"),
    password: formData.get("password") || undefined,
  });

  const rawEmail = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: t.errors.invalidEmail, email: rawEmail };

  const { intent, email, password } = parsed.data;
  const supabase = await createClient();

  if (intent === "magic") {
    // Réponse identique que l'adresse soit autorisée ou non (pas d'énumération des comptes)
    if (isEmailAllowed(email)) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // F-02 : jamais de création de compte
          emailRedirectTo: `${await getSiteUrl()}/auth/callback`,
        },
      });
      if (error && error.code && RATE_LIMIT_CODES.has(error.code)) {
        return { error: t.errors.rateLimited, email };
      }
    }
    return { message: t.magicLinkSent, email };
  }

  if (!password) return { error: t.errors.passwordRequired, email };

  // F-02 : adresse non autorisée refusée avant même d'interroger Supabase
  if (!isEmailAllowed(email)) return { error: t.errors.invalidCredentials, email };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code && RATE_LIMIT_CODES.has(error.code)) return { error: t.errors.rateLimited, email };
    return { error: t.errors.invalidCredentials, email };
  }
  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return { error: t.errors.forbidden, email };
  }

  redirect("/dashboard");
}
