// Crée l'utilisateur propriétaire dans le Supabase LOCAL (développement uniquement).
// Usage : node --env-file=.env.local scripts/create-user.mjs adresse@exemple.com MotDePasse
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage : node --env-file=.env.local scripts/create-user.mjs <courriel> <mot de passe>");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Échec :", error.message);
  process.exit(1);
}
console.log(`Utilisateur ${email} créé. Pensez à l'ajouter dans ALLOWED_EMAILS.`);
