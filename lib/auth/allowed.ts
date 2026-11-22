import "server-only";

// F-02 : seules les adresses listées dans ALLOWED_EMAILS (séparées par des virgules)
// peuvent se connecter. Aucune adresse n'est codée en dur.
// Si la variable est vide ou absente, personne n'est autorisé (fermé par défaut).
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
