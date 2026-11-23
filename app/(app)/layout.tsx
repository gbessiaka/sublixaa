import { Bell, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/auth/session";
import { getAppConfig } from "@/lib/config";
import { formatInTz } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";
import { signOut } from "./actions";
import { Sidebar } from "./sidebar";

// Garde côté serveur : rien de l'espace connecté n'est rendu sans propriétaire autorisé.
// Placée sous <Suspense> car elle lit la session au moment de la requête (Cache Components).
async function OwnerGate({ children }: { children: React.ReactNode }) {
  const { supabase, user, settings } = await getOwnerContext();
  const t = getDictionary();
  const { appName } = getAppConfig();

  // Nombre d'éléments à traiter, affiché dans le menu et le bandeau
  const [{ count: toReview }, { count: failed }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "to_review"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const taskCount = (toReview ?? 0) + (failed ?? 0);

  const email = user.email ?? "";
  const today = formatInTz(new Date(), settings.timeZone, "EEEE d MMMM yyyy");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        appName={appName}
        tagline={t.nav.tagline}
        menuLabel={t.nav.menu}
        main={[
          { key: "dashboard", href: "/dashboard", label: t.nav.dashboard },
          { key: "clients", href: "/clients", label: t.nav.clients },
          { key: "strategy", href: "/strategy", label: t.nav.strategy },
          { key: "calendar", href: "/calendar", label: t.nav.calendar },
          { key: "content", href: "/content", label: t.nav.content },
          { key: "tasks", href: "/tasks", label: t.nav.tasks, badge: taskCount },
          { key: "reports", href: "/reports", label: t.nav.reports },
        ]}
        bottom={[{ key: "settings", href: "/settings", label: t.nav.settings }]}
        user={{ name: email.split("@")[0] || email, email, role: t.nav.owner }}
        signOutLabel={t.auth.signOut}
        signOut={signOut}
      />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/80 pr-4 pl-16 backdrop-blur lg:px-8">
          <p className="flex items-center gap-2 text-sm text-muted-foreground first-letter:uppercase">
            <CalendarDays className="size-4" />
            <span className="first-letter:uppercase">{today}</span>
          </p>
          <Link
            href="/tasks"
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t.nav.tasks}
            title={t.nav.tasks}
          >
            <Bell className="size-5" />
            {taskCount > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OwnerGate>{children}</OwnerGate>
    </Suspense>
  );
}
