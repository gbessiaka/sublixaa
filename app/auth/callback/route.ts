import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowed";
import { createClient } from "@/lib/supabase/server";

// Retour du lien magique. Accepte les deux formats de Supabase :
// - ?code=…              (flux PKCE, modèle de courriel par défaut)
// - ?token_hash=…&type=… (modèle de courriel personnalisé)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = "";

  if (!ok) {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
    return NextResponse.redirect(target);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isEmailAllowed(user?.email)) {
    await supabase.auth.signOut();
    target.pathname = "/login";
    target.searchParams.set("error", "forbidden");
    return NextResponse.redirect(target);
  }

  target.pathname = "/dashboard";
  return NextResponse.redirect(target);
}
