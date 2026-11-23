import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Link2,
  PenLine,
  Send,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PostList, type PostListRow as PostRow } from "@/components/post-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, monthRangeUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { NETWORK_IDS, isNetworkId } from "@/lib/network-rules";
import { cn } from "@/lib/utils";
import { NetworkFilter } from "./network-filter";

function EmptyState({ icon: Icon, text, href, cta }: { icon: LucideIcon; text: string; href: string; cta: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        {cta}
      </Link>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: string; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, hint, href, linkLabel }: { title: string; hint?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {linkLabel}
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

// F-33 à F-35 (et F-38) : vue d'ensemble, tous clients
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const t = getDictionary();
  const d = t.dashboard;
  const sp = await searchParams;
  const network = typeof sp.network === "string" && isNetworkId(sp.network) ? sp.network : "";
  const { supabase, settings } = await getOwnerContext();
  const tz = settings.timeZone;

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const stuckBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const thisMonth = monthRangeUtc(currentMonth(tz), tz);
  const lastMonth = monthRangeUtc(currentMonth(tz, -1), tz);
  const select = "id, scheduled_at, published_at, network, body, topic, status, clients(name)";
  const published = ["published", "published_manually"];

  // Applique le filtre réseau à une requête sur les publications ou les comptes
  const byNetwork = <Q extends { eq: (col: string, v: string) => Q }>(q: Q): Q => (network ? q.eq("network", network) : q);
  const countPosts = () => supabase.from("posts").select("id", { count: "exact", head: true });

  const [upcoming, recent, pubThis, pubLast, toReview, failed, stuck, accounts, costs] = await Promise.all([
    byNetwork(supabase.from("posts").select(select)).gte("scheduled_at", now.toISOString()).lte("scheduled_at", in7Days.toISOString()).in("status", ["draft", "to_review", "scheduled"]).order("scheduled_at").limit(8),
    byNetwork(supabase.from("posts").select(select)).in("status", published).order("published_at", { ascending: false }).limit(8),
    byNetwork(countPosts()).in("status", published).gte("published_at", thisMonth.start.toISOString()).lt("published_at", thisMonth.end.toISOString()),
    byNetwork(countPosts()).in("status", published).gte("published_at", lastMonth.start.toISOString()).lt("published_at", lastMonth.end.toISOString()),
    byNetwork(countPosts()).eq("status", "to_review"),
    byNetwork(countPosts()).eq("status", "failed"),
    byNetwork(countPosts()).eq("status", "publishing").lt("updated_at", stuckBefore.toISOString()),
    byNetwork(supabase.from("social_accounts").select("status")),
    supabase.from("ai_generations").select("cost_usd").gte("created_at", thisMonth.start.toISOString()).lt("created_at", thisMonth.end.toISOString()),
  ]);

  const accountRows = accounts.data ?? [];
  const toRenew = accountRows.filter((a) => a.status === "expiring" || a.status === "expired").length;
  const totalCost = (costs.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const upcomingRows = (upcoming.data ?? []) as PostRow[];
  const recentRows = (recent.data ?? []) as PostRow[];

  const taskLines = [
    { count: toReview.count ?? 0, text: d.tasksSummary.toReview, icon: ClipboardCheck },
    { count: failed.count ?? 0, text: d.tasksSummary.failed, icon: AlertTriangle },
    { count: stuck.count ?? 0, text: d.tasksSummary.stuck, icon: CalendarClock },
    { count: toRenew, text: d.tasksSummary.accounts, icon: Link2 },
  ].filter((l) => l.count > 0);

  const shortcuts = [
    { href: "/strategy", icon: Target, tone: "bg-violet-100 text-violet-700", ...d.shortcutItems.strategy },
    { href: "/content", icon: PenLine, tone: "bg-sky-100 text-sky-700", ...d.shortcutItems.content },
    { href: "/calendar", icon: CalendarDays, tone: "bg-emerald-100 text-emerald-700", ...d.shortcutItems.calendar },
    { href: "/reports", icon: ChartNoAxesColumn, tone: "bg-amber-100 text-amber-700", ...d.shortcutItems.reports },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
          <p className="text-muted-foreground">{d.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NetworkFilter
            value={network}
            allLabel={d.allNetworks}
            options={NETWORK_IDS.map((id) => ({ id, label: (t.networks as Record<string, string>)[id] ?? id }))}
          />
          <Button asChild className="h-10 px-4">
            <Link href="/content">
              <PenLine />
              {d.generate}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Send} tone="bg-secondary text-primary" label={d.stats.publishedMonth} value={String(pubThis.count ?? 0)} hint={interpolate(d.stats.vsLastMonth, { count: String(pubLast.count ?? 0) })} />
        <Stat icon={CalendarClock} tone="bg-sky-100 text-sky-700" label={d.stats.upcoming} value={String(upcomingRows.length)} />
        <Stat icon={ClipboardCheck} tone="bg-violet-100 text-violet-700" label={d.stats.toReview} value={String(toReview.count ?? 0)} />
        <Stat icon={AlertTriangle} tone="bg-rose-100 text-rose-700" label={d.stats.failed} value={String(failed.count ?? 0)} />
        <Stat icon={Link2} tone="bg-emerald-100 text-emerald-700" label={d.stats.accounts} value={String(accountRows.length)} hint={toRenew ? interpolate(d.stats.accountsToRenew, { count: String(toRenew) }) : undefined} />
        <Stat icon={Coins} tone="bg-amber-100 text-amber-700" label={d.stats.aiCost} value={`${totalCost.toFixed(2)} $`} hint={interpolate(d.stats.aiCalls, { count: String(costs.data?.length ?? 0) })} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-4 p-6">
          <SectionHeader title={d.shortcuts} hint={d.shortcutsHint} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {shortcuts.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", s.tone)}>
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="gap-2 p-6">
          <SectionHeader title={d.next7Days} hint={d.upcomingHint} href="/calendar" linkLabel={d.seeAll} />
          {upcomingRows.length ? (
            <PostList posts={upcomingRows} timeZone={tz} dateField="scheduled_at" />
          ) : (
            <EmptyState icon={CalendarDays} text={d.noUpcoming} href="/calendar" cta={d.planPost} />
          )}
        </Card>

        <Card className="gap-4 border-primary/15 bg-secondary/60 p-6">
          <SectionHeader title={d.tasksTitle} href="/tasks" linkLabel={d.seeAllTasks} />
          {taskLines.length ? (
            <ul className="flex flex-col gap-2">
              {taskLines.map((l) => (
                <li key={l.text}>
                  <Link href="/tasks" className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-sm shadow-xs hover:bg-muted">
                    <l.icon className="size-4 text-primary" />
                    {interpolate(l.text, { count: String(l.count) })}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{d.nothingToFix}</p>
          )}
        </Card>
      </div>

      <Card className="gap-2 p-6">
        <SectionHeader title={d.recent} href="/content?status=published" linkLabel={d.seeAll} />
        {recentRows.length ? (
          <PostList posts={recentRows} timeZone={tz} dateField="published_at" />
        ) : (
          <EmptyState icon={Send} text={d.noRecent} href="/content" cta={d.createPost} />
        )}
      </Card>
    </div>
  );
}
