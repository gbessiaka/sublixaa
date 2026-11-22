import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Client « serveur » avec la clé secrète : contourne RLS.
// Réservé au planificateur et à la lecture des jetons ; toujours filtrer par owner_id.
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY manquante (voir .env.example)");
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
