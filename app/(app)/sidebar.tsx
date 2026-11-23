"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PenLine,
  Settings,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Les icônes restent côté client : seules les clés et les libellés viennent du serveur
const ICONS = {
  dashboard: LayoutGrid,
  clients: Users,
  strategy: Target,
  calendar: CalendarDays,
  content: PenLine,
  tasks: ListChecks,
  reports: ChartNoAxesColumn,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavKey = keyof typeof ICONS;
export type NavItem = { key: NavKey; href: string; label: string; badge?: number };

type SidebarProps = {
  appName: string;
  tagline: string;
  menuLabel: string;
  main: NavItem[];
  bottom: NavItem[];
  user: { name: string; email: string; role: string };
  signOutLabel: string;
  signOut: () => Promise<void>;
};

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = ICONS[item.key];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ appName, tagline, menuLabel, main, bottom, user, signOutLabel, signOut }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Bouton d'ouverture sur mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-lg border bg-card p-2 shadow-sm lg:hidden"
        aria-label={menuLabel}
      >
        <Menu className="size-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={close} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar px-4 py-6 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-start justify-between px-2">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              {appName.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-bold">{appName}</span>
              <span className="text-xs text-muted-foreground">{tagline}</span>
            </span>
          </Link>
          <button type="button" onClick={close} className="lg:hidden" aria-label={menuLabel}>
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {main.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={close} />
          ))}
        </nav>

        <div className="flex flex-col gap-1">
          {bottom.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={close} />
          ))}
          <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/50 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium" title={user.email}>
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground">{user.role}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={signOutLabel}
                title={signOutLabel}
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
