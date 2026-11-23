import { TZDate } from "@date-fns/tz";
import { addDays, getISOWeek, startOfWeek, subWeeks } from "date-fns";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { PostList, type PostListRow } from "@/components/post-list";
import { Button } from "@/components/ui/button";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, formatInTz, monthRangeUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { NETWORK_IDS, isNetworkId } from "@/lib/network-rules";
import { cn } from "@/lib/utils";

const PLANNED = ["draft", "to_review", "scheduled"];
const PUBLISHED = ["published", "published_manually"];

// Index du dernier début de période inférieur ou égal à la date (-1 si avant la première)
function bucketOf(date: Date, starts: Date[]): number {
  let idx = -1;
  for (let i = 0; i < starts.length; i++) if (date >= starts[i]) idx = i;
  return idx;
}

// Mini-graphique en barres ; la barre mise en avant est la dernière par défaut
function MiniBars({ values, highlight = values.length - 1, dark = false }: { values: number[]; highlight?: number; dark?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-2.5 rounded-full",
            i === highlight ? (dark ? "bg-highlight" : "bg-primary") : dark ? "bg-chart-soft/70" : "bg-chart-soft/60",
          )}
          style={{ height: `${Math.max(10, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Kpi({ label, value, hint, bars, dark = false, highlight }: { label: string; value: string; hint?: string; bars: number[]; dark?: boolean; highlight?: number }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 rounded-3xl p-5", dark ? "bg-sidebar text-sidebar-foreground" : "bg-card")}>
      <div className="min-w-0">
        <p className={cn("text-sm", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{label}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && (
          <span className={cn("mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", dark ? "bg-highlight text-highlight-foreground" : "bg-muted text-foreground/80")}>
            {hint}
          </span>
        )}
      </div>
      <MiniBars values={bars} dark={dark} highlight={highlight} />
    </div>
  );
}

function Panel({ title, hint, action, className, children }: { title: string; hint?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl bg-card p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PillLink({ href, children, variant = "outline" }: { href: string; children: React.ReactNode; variant?: "outline" | "highlight" }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        variant === "outline" ? "border border-foreground/25 hover:bg-muted" : "bg-highlight text-highlight-foreground hover:bg-highlight/85",
      )}
    >
      {children}
    </Link>
  );
}

// F-33 à F-35 (et F-38) : vue d'ensemble, tous clients
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const t = getDictionary();
  const d = t.dashboard;
  const networkLabels = t.networks as Record<string, string>;
  const sp = await searchParams;
  const network = typeof sp.network === "string" && isNetworkId(sp.network) ? sp.network : "";
  const { supabase, settings } = await getOwnerContext();
  const tz = settings.timeZone;

  // Repères de temps, calculés dans le fuseau du propriétaire
  const now = new Date();
  const weekStart = startOfWeek(new TZDate(now, tz), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStarts = Array.from({ length: 8 }, (_, i) => subWeeks(weekStart, 7 - i));
  const today = new TZDate(now, tz);
  today.setHours(0, 0, 0, 0);
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const in28Days = new Date(now.getTime() + 28 * 24 * 3600 * 1000);
  const stuckBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const thisMonth = monthRangeUtc(currentMonth(tz), tz);
  const lastMonth = monthRangeUtc(currentMonth(tz, -1), tz);
  const since = new Date(Math.min(lastMonth.start.getTime(), weekStarts[0].getTime()));

  // Applique le filtre réseau à une requête
  const byNetwork = <Q extends { eq: (col: string, v: string) => Q }>(q: Q): Q => (network ? q.eq("network", network) : q);
  const countPosts = () => supabase.from("posts").select("id", { count: "exact", head: true });

  const [planned, published, recent, toReview, failed, stuck, accounts, monthPosts, costs] = await Promise.all([
    byNetwork(supabase.from("posts").select("id, scheduled_at, network, body, topic, status, clients(name), post_media(storage_path, position)"))
      .gte("scheduled_at", weekStart.toISOString())
      .lte("scheduled_at", in28Days.toISOString())
      .in("status", PLANNED)
      .order("scheduled_at"),
    byNetwork(supabase.from("posts").select("published_at")).in("status", PUBLISHED).gte("published_at", since.toISOString()),
    byNetwork(supabase.from("posts").select("id, scheduled_at, published_at, network, body, topic, status, clients(name)")).in("status", PUBLISHED).order("published_at", { ascending: false }).limit(6),
    byNetwork(supabase.from("posts").select("client_id")).eq("status", "to_review"),
    byNetwork(countPosts()).eq("status", "failed"),
    byNetwork(countPosts()).eq("status", "publishing").lt("updated_at", stuckBefore.toISOString()),
    byNetwork(supabase.from("social_accounts").select("status")).in("status", ["expiring", "expired"]),
    byNetwork(supabase.from("posts").select("network")).gte("scheduled_at", thisMonth.start.toISOString()).lt("scheduled_at", thisMonth.end.toISOString()),
    supabase.from("ai_generations").select("created_at, cost_usd").gte("created_at", since.toISOString()),
  ]);

  // Indicateurs
  const inRange = (dt: Date, r: { start: Date; end: Date }) => dt >= r.start && dt < r.end;
  const publishedDates = (published.data ?? []).map((p) => new Date(p.published_at!));
  const pubThisMonth = publishedDates.filter((dt) => inRange(dt, thisMonth)).length;
  const pubLastMonth = publishedDates.filter((dt) => inRange(dt, lastMonth)).length;
  const delta = pubThisMonth - pubLastMonth;
  const pubPerWeek = weekStarts.map(() => 0);
  for (const dt of publishedDates) {
    const i = bucketOf(dt, weekStarts);
    if (i >= 0) pubPerWeek[i]++;
  }

  const plannedRows = planned.data ?? [];
  const upcomingRows = plannedRows.filter((p) => new Date(p.scheduled_at!) >= now && new Date(p.scheduled_at!) <= in7Days);
  const upcomingPerDay = next7Days.map(() => 0);
  for (const p of upcomingRows) {
    const i = bucketOf(new Date(p.scheduled_at!), next7Days);
    if (i >= 0) upcomingPerDay[i]++;
  }

  const reviewByClient = new Map<string, number>();
  for (const r of toReview.data ?? []) reviewByClient.set(r.client_id, (reviewByClient.get(r.client_id) ?? 0) + 1);
  const reviewBars = [...reviewByClient.values()].sort((a, b) => a - b);
  const reviewCount = toReview.data?.length ?? 0;

  const costPerWeek = weekStarts.map(() => 0);
  let monthCost = 0;
  let monthCalls = 0;
  for (const c of costs.data ?? []) {
    const dt = new Date(c.created_at);
    const i = bucketOf(dt, weekStarts);
    if (i >= 0) costPerWeek[i] += Number(c.cost_usd ?? 0);
    if (inRange(dt, thisMonth)) {
      monthCost += Number(c.cost_usd ?? 0);
      monthCalls++;
    }
  }

  // Vignettes des prochaines publications (URL signées, bucket privé)
  const firstMedia = (p: (typeof upcomingRows)[number]) => [...(p.post_media ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
  const shown = upcomingRows.slice(0, 5);
  const paths = shown.map(firstMedia).filter((x): x is string => !!x);
  const signed = paths.length ? ((await supabase.storage.from("post-media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  // À traiter
  const taskRows = [
    { count: reviewCount, ...d.tasks.toReview },
    { count: failed.count ?? 0, ...d.tasks.failed },
    { count: stuck.count ?? 0, ...d.tasks.stuck },
    { count: accounts.data?.length ?? 0, ...d.tasks.accounts },
  ].filter((r) => r.count > 0);

  // Cette semaine, jour par jour
  const weekPublished = weekDays.map(() => 0);
  for (const dt of publishedDates) {
    const i = bucketOf(dt, weekDays);
    if (i >= 0 && dt < weekEnd) weekPublished[i]++;
  }
  const weekPlanned = weekDays.map(() => 0);
  for (const p of plannedRows) {
    const dt = new Date(p.scheduled_at!);
    const i = bucketOf(dt, weekDays);
    if (i >= 0 && dt < weekEnd) weekPlanned[i]++;
  }
  const weekMax = Math.max(1, ...weekDays.map((_, i) => weekPublished[i] + weekPlanned[i]));
  const todayIdx = bucketOf(now, weekDays);

  // Par réseau ce mois-ci
  const perNetwork = new Map<string, number>();
  for (const p of monthPosts.data ?? []) perNetwork.set(p.network, (perNetwork.get(p.network) ?? 0) + 1);
  const networkRows = [...perNetwork.entries()].sort((a, b) => b[1] - a[1]);
  const networkMax = Math.max(1, ...networkRows.map(([, n]) => n));

  // Planning sur 4 semaines : jour de la semaine × créneau
  const slots = ["morning", "noon", "afternoon", "evening", "night"] as const;
  const slotOf = (h: number) => (h >= 5 && h < 11 ? 0 : h >= 11 && h < 14 ? 1 : h >= 14 && h < 18 ? 2 : h >= 18 && h < 23 ? 3 : 4);
  const heat = slots.map(() => Array<number>(7).fill(0));
  for (const p of plannedRows) {
    const dt = new Date(p.scheduled_at!);
    if (dt < now) continue;
    const local = new TZDate(dt, tz);
    heat[slotOf(local.getHours())][(local.getDay() + 6) % 7]++;
  }
  const heatMax = Math.max(1, ...heat.flat());
  const heatTone = (n: number) => {
    if (n === 0) return "bg-muted";
    if (n === heatMax) return "bg-highlight";
    const r = n / heatMax;
    return r > 0.6 ? "bg-primary/70" : r > 0.3 ? "bg-chart-soft" : "bg-chart-soft/50";
  };
  const dayInitials = weekDays.map((day) => formatInTz(day, tz, "EEEEE").toUpperCase());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{d.title}</h1>
          <p className="text-sm text-muted-foreground">
            {interpolate(d.period, {
              week: String(getISOWeek(weekStart)),
              from: formatInTz(weekStart, tz, "d"),
              to: formatInTz(addDays(weekStart, 6), tz, "d MMMM"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10 px-5">
            <Link href="/reports">{d.exportPdf}</Link>
          </Button>
          <Button asChild className="h-10 px-5">
            <Link href="/calendar">{d.openCalendar}</Link>
          </Button>
        </div>
      </div>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {["", ...NETWORK_IDS].map((id) => (
          <Link
            key={id || "all"}
            href={id ? `/dashboard?network=${id}` : "/dashboard"}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              network === id ? "bg-sidebar text-sidebar-foreground" : "border border-foreground/20 hover:bg-card",
            )}
          >
            {id ? networkLabels[id] : d.allNetworks}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi dark label={d.kpi.published} value={String(pubThisMonth)} hint={interpolate(d.kpi.publishedDelta, { delta: `${delta >= 0 ? "+" : ""}${delta}` })} bars={pubPerWeek} />
        <Kpi label={d.kpi.upcoming} value={String(upcomingRows.length)} hint={interpolate(d.kpi.upcomingHint, { count: String(upcomingPerDay[0]) })} bars={upcomingPerDay} highlight={0} />
        <Kpi label={d.kpi.toReview} value={String(reviewCount)} hint={interpolate(d.kpi.toReviewHint, { count: String(reviewByClient.size) })} bars={reviewBars.length ? reviewBars : [0, 0, 0]} />
        <Kpi label={d.kpi.cost} value={`${monthCost.toFixed(2)} $`} hint={interpolate(d.kpi.costHint, { count: String(monthCalls) })} bars={costPerWeek} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={d.next}
          hint={d.nextHint}
          action={upcomingRows.length > 0 && <PillLink href="/calendar">{interpolate(d.seeAllCount, { count: String(upcomingRows.length) })}</PillLink>}
        >
          {shown.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {shown.map((p, i) => {
                const path = firstMedia(p);
                const url = path ? urlByPath.get(path) : undefined;
                return (
                  <Link key={p.id} href={`/content/${p.id}`} className="group flex flex-col gap-2">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-secondary-foreground/50">
                          <FileText className="size-7" />
                        </div>
                      )}
                      <span
                        className={cn(
                          "absolute top-2 left-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          i === 0 ? "bg-highlight text-highlight-foreground" : "bg-card text-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium">{networkLabels[p.network] ?? p.network}</span>
                    </div>
                    <div>
                      <p className="font-semibold first-letter:uppercase">{formatInTz(p.scheduled_at!, tz, "EEE d, HH:mm")}</p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {(p.clients as { name: string } | null)?.name} · {p.topic || p.body}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">{d.noUpcoming}</p>
              <PillLink href="/calendar">{d.planPost}</PillLink>
            </div>
          )}
        </Panel>

        <section className="flex flex-col gap-3 rounded-3xl bg-sidebar p-6 text-sidebar-foreground">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{d.tasksTitle}</h2>
            <PillLink href="/tasks" variant="highlight">
              {d.seeAll}
              <ChevronRight className="size-4" />
            </PillLink>
          </div>
          {taskRows.length ? (
            taskRows.map((r) => (
              <Link key={r.title} href="/tasks" className="rounded-2xl bg-sidebar-accent p-4 transition-colors hover:bg-sidebar-accent/70">
                <p className="font-semibold">{interpolate(r.title, { count: String(r.count) })}</p>
                <p className="text-sm text-sidebar-muted">{r.hint}</p>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl bg-sidebar-accent p-4 text-sm text-sidebar-muted">{d.nothingToFix}</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={d.week}
          action={
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                {d.weekLegend.published}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-highlight" />
                {d.weekLegend.planned}
              </span>
            </div>
          }
        >
          <div className="flex h-44 items-end justify-between gap-2">
            {weekDays.map((day, i) => {
              const total = weekPublished[i] + weekPlanned[i];
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex w-full max-w-8 flex-1 flex-col justify-end gap-1">
                    {weekPlanned[i] > 0 && <span className="w-full rounded-lg bg-highlight" style={{ height: `${(weekPlanned[i] / weekMax) * 100}%` }} />}
                    {weekPublished[i] > 0 && <span className="w-full rounded-lg bg-primary" style={{ height: `${(weekPublished[i] / weekMax) * 100}%` }} />}
                    {total === 0 && <span className="h-1.5 w-full rounded-full bg-muted" />}
                  </div>
                  <span className={cn("text-xs", i === todayIdx ? "rounded-full bg-sidebar px-2 font-semibold text-sidebar-foreground" : "text-muted-foreground")}>
                    {formatInTz(day, tz, "EEE").replace(".", "")}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={d.byNetwork}>
          {networkRows.length ? (
            <ul className="flex flex-col gap-4">
              {networkRows.map(([id, n], i) => (
                <li key={id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{networkLabels[id] ?? id}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-chart-soft")} style={{ width: `${(n / networkMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{d.byNetworkEmpty}</p>
          )}
        </Panel>

        <Panel title={d.heatmap} hint={d.heatmapHint}>
          <div className="grid grid-cols-[auto_repeat(7,1fr)] items-center gap-1.5 text-xs">
            <span />
            {dayInitials.map((l, i) => (
              <span key={i} className="text-center text-muted-foreground">
                {l}
              </span>
            ))}
            {slots.map((s, si) => (
              <div key={s} className="contents">
                <span className="pr-2 text-muted-foreground">{d.slots[s]}</span>
                {heat[si].map((n, di) => (
                  <span key={di} className={cn("h-6 rounded-md", heatTone(n))} title={String(n)} />
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={d.recent} action={<PillLink href="/content?status=published">{d.seeAll}</PillLink>}>
        {recent.data?.length ? (
          <PostList posts={recent.data as PostListRow[]} timeZone={tz} dateField="published_at" />
        ) : (
          <p className="text-sm text-muted-foreground">{d.noRecent}</p>
        )}
      </Panel>
    </div>
  );
}
