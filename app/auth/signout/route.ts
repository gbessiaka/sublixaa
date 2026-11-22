import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ferme la session puis renvoie vers /login (utilisé quand une adresse non autorisée
// se retrouve connectée : un composant serveur ne peut pas modifier les cookies lui-même)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  if (request.nextUrl.searchParams.get("error") === "forbidden") {
    target.searchParams.set("error", "forbidden");
  }
  return NextResponse.redirect(target);
}
