import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/session";
import { getAppConfig } from "@/lib/config";
import { getDictionary, interpolate } from "@/lib/i18n";
import { signOut } from "./actions";
import { NavLinks } from "./nav-links";

// Garde côté serveur : rien de l'espace connecté n'est rendu sans propriétaire autorisé.
// Placée sous <Suspense> car elle lit la session au moment de la requête (Cache Components).
async function OwnerGate({ children }: { children: React.ReactNode }) {
  const user = await requireOwner();
  const dict = getDictionary();
  const { appName } = getAppConfig();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
          <nav className="flex items-center gap-4 overflow-x-auto sm:gap-6">
            <Link href="/dashboard" className="shrink-0 font-semibold">
              {appName}
            </Link>
            <NavLinks
              links={[
                { href: "/dashboard", label: dict.nav.dashboard },
                { href: "/clients", label: dict.nav.clients },
                { href: "/content", label: dict.nav.content },
                { href: "/calendar", label: dict.nav.calendar },
                { href: "/settings", label: dict.nav.settings },
              ]}
            />
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {interpolate(dict.auth.signedInAs, { email: user.email ?? "" })}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                {dict.auth.signOut}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <OwnerGate>{children}</OwnerGate>
    </Suspense>
  );
}
