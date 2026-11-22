import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

// Client Supabase côté serveur (composants serveur, actions serveur, route handlers),
// agissant au nom de l'utilisateur connecté : les règles RLS s'appliquent.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur : écriture impossible, sans gravité
          // car le proxy rafraîchit la session à chaque requête.
        }
      },
    },
  });
}
