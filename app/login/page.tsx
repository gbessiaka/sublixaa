import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LegalFooter } from "@/components/legal-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isEmailAllowed } from "@/lib/auth/allowed";
import { getAppConfig } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

// Partie lue au moment de la requête (session, paramètres d'URL)
async function LoginFormSection({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const t = getDictionary().auth;

  // Déjà connecté avec une adresse autorisée : direction le tableau de bord
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && isEmailAllowed(user.email)) redirect("/dashboard");

  const { error } = await searchParams;
  const initialError =
    error === "forbidden" ? t.errors.forbidden : error === "link" ? t.errors.linkInvalid : undefined;

  return <LoginForm t={t} initialError={initialError} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = getDictionary().auth;
  const { appName } = getAppConfig();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">{appName}</p>
          <CardTitle className="text-xl">{t.loginTitle}</CardTitle>
          <CardDescription>{t.loginDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-64" />}>
            <LoginFormSection searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
      <LegalFooter />
    </main>
  );
}
