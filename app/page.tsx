import { redirect } from "next/navigation";

// La racine renvoie au tableau de bord (le proxy redirige vers /login si besoin)
export default function Home() {
  redirect("/dashboard");
}
