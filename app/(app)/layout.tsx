import { Bell, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
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
  const [{ count: toReview }, { count: failed }, { data: clients }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "to_review"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
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
        clientsLabel={t.nav.clientsSection}
        clients={clients ?? []}
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
        <header className="flex h-20 items-center justify-between gap-3 pr-4 pl-16 lg:px-8">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="first-letter:uppercase">{today}</span>
          </p>
          <div className="flex items-center gap-3">
            <Button asChild variant="highlight" className="h-10 px-5">
              <Link href="/content">
                <Plus />
                <span className="hidden sm:inline">{t.dashboard.newPost}</span>
              </Link>
            </Button>
            <Link
              href="/tasks"
              className="relative flex size-10 items-center justify-center rounded-full bg-card text-foreground shadow-xs hover:bg-muted"
              aria-label={t.nav.tasks}
              title={t.nav.tasks}
            >
              <Bell className="size-[18px]" />
              {taskCount > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-orange-500" />}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-10 lg:px-8">{children}</main>
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
