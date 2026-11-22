// URL et clé publique Supabase (la clé publishable/anon est conçue pour être exposée ;
// la sécurité des données repose sur les règles RLS)
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes (voir .env.example)",
    );
  }
  return { url, key };
}
