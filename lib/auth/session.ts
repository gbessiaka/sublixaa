import "server-only";
import { redirect } from "next/navigation";
import { getOwnerSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "./allowed";

// Vérifie côté serveur qu'un utilisateur autorisé est connecté et le renvoie.
// À appeler dans chaque layout, page ou action protégée.
export async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // Session valide mais adresse non autorisée (F-02) : on ferme la session
  if (!isEmailAllowed(user.email)) redirect("/auth/signout?error=forbidden");

  return user;
}

// Contexte complet d'une requête protégée : client Supabase (RLS), utilisateur et paramètres
export async function getOwnerContext() {
  const user = await requireOwner();
  const supabase = await createClient();
  const settings = await getOwnerSettings(supabase, user.id);
  return { supabase, user, settings };
}

// Variante pour les actions serveur : ne redirige pas, renvoie null si non autorisé
export async function getOwnerContextOrNull() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEmailAllowed(user.email)) return null;
  const settings = await getOwnerSettings(supabase, user.id);
  return { supabase, user, settings };
}
