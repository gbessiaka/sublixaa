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

// Pastilles de couleur des clients, attribuées dans l'ordre
const CLIENT_DOTS = ["bg-highlight", "bg-orange-300", "bg-emerald-300", "bg-sky-300", "bg-rose-300"];

export type NavKey = keyof typeof ICONS;
export type NavItem = { key: NavKey; href: string; label: string; badge?: number };

type SidebarProps = {
  appName: string;
  tagline: string;
  menuLabel: string;
  clientsLabel: string;
  main: NavItem[];
  bottom: NavItem[];
  clients: { id: string; name: string }[];
  user: { name: string; email: string; role: string };
  signOutLabel: string;
  signOut: () => Promise<void>;
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const isActive = useIsActive();
  const active = isActive(item.href);
  const Icon = ICONS[item.key];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-highlight text-highlight-foreground" : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            active ? "bg-highlight-foreground/10" : "bg-sidebar-accent text-highlight",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ appName, tagline, menuLabel, clientsLabel, main, bottom, clients, user, signOutLabel, signOut }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const isActive = useIsActive();

  return (
    <>
      {/* Bouton d'ouverture sur mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-full bg-sidebar p-2.5 text-sidebar-foreground shadow-md lg:hidden"
        aria-label={menuLabel}
      >
        <Menu className="size-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={close} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-sidebar px-4 py-6 text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-start justify-between px-2">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-highlight text-base font-bold text-highlight-foreground">
              {appName.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight">{appName}</span>
              <span className="text-xs text-sidebar-muted">{tagline}</span>
            </span>
          </Link>
          <button type="button" onClick={close} className="lg:hidden" aria-label={menuLabel}>
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {main.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={close} />
          ))}
        </nav>

        {clients.length > 0 && (
          <div className="mt-8 flex flex-col gap-0.5">
            <p className="px-3 pb-2 text-xs text-sidebar-muted">{clientsLabel}</p>
            {clients.map((c, i) => {
              const href = `/clients/${c.id}`;
              return (
                <Link
                  key={c.id}
                  href={href}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    isActive(href) ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/80",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", CLIENT_DOTS[i % CLIENT_DOTS.length])} />
                  <span className="truncate">{c.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1 pt-8">
          {bottom.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={close} />
          ))}
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-sidebar-accent p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-200 text-sm font-semibold text-orange-900">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium" title={user.email}>
                {user.name}
              </span>
              <span className="text-xs text-sidebar-muted">{user.role}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full p-1.5 text-sidebar-muted hover:bg-sidebar hover:text-sidebar-foreground"
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
