import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Client Supabase côté navigateur (clé publique uniquement ; RLS s'applique).
// Utilisé seulement pour envoyer les images directement dans le stockage.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
