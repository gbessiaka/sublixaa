import "server-only";
import { redirect } from "next/navigation";
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
