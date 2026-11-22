import Link from "next/link";
import { NetworkBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { formatInTz, monthRangeUtc, currentMonth } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";

type PostRow = { id: string; scheduled_at: string | null; published_at: string | null; network: string; body: string; topic: string | null; status: string; error_message: string | null; clients: { name: string } | null };

function PostList({ posts, timeZone, dateField, empty }: { posts: PostRow[]; timeZone: string; dateField: "scheduled_at" | "published_at"; empty: string }) {
  if (!posts.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y">
      {posts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="w-32 shrink-0 text-muted-foreground">{p[dateField] ? formatInTz(p[dateField]!, timeZone, "EEE d MMM HH:mm") : "—"}</span>
          <NetworkBadge network={p.network} />
          <span className="font-medium">{p.clients?.name}</span>
          <Link href={`/content/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">
            {p.topic || p.body}
          </Link>
          <StatusBadge status={p.status} />
          {p.error_message && <span className="basis-full text-xs text-destructive">{p.error_message}</span>}
        </li>
      ))}
    </ul>
  );
}

// F-33 à F-35 (et F-38) : vue d'ensemble, tous clients
export default async function DashboardPage() {
  const t = getDictionary();
  const { supabase, settings } = await getOwnerContext();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const stuckBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const { start, end } = monthRangeUtc(currentMonth(settings.timeZone), settings.timeZone);
  const select = "id, scheduled_at, published_at, network, body, topic, status, error_message, clients(name)";

  const [upcoming, failed, stuck, accounts, recent, costs] = await Promise.all([
    supabase.from("posts").select(select).gte("scheduled_at", now.toISOString()).lte("scheduled_at", in7Days.toISOString()).in("status", ["draft", "to_review", "scheduled"]).order("scheduled_at"),
    supabase.from("posts").select(select).eq("status", "failed").order("scheduled_at", { ascending: false }),
    supabase.from("posts").select(select).eq("status", "publishing").lt("updated_at", stuckBefore.toISOString()),
    supabase.from("social_accounts").select("id, client_id, network, display_name, status, token_expires_at, clients(name)").in("status", ["expiring", "expired"]),
    supabase.from("posts").select(select).in("status", ["published", "published_manually"]).order("published_at", { ascending: false }).limit(10),
    supabase.from("ai_generations").select("cost_usd").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
  ]);
  const totalCost = (costs.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const nothingToFix = !failed.data?.length && !stuck.data?.length && !accounts.data?.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">
          {interpolate(t.dashboard.aiCost, { cost: totalCost.toFixed(4), count: String(costs.data?.length ?? 0) })}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.next7Days}</CardTitle>
          </CardHeader>
          <CardContent>
            <PostList posts={(upcoming.data ?? []) as PostRow[]} timeZone={settings.timeZone} dateField="scheduled_at" empty={t.dashboard.noUpcoming} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.toFix}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {nothingToFix && <p className="text-sm text-muted-foreground">{t.dashboard.nothingToFix}</p>}
            {!!failed.data?.length && (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t.dashboard.failedPosts}</h3>
                <PostList posts={failed.data as PostRow[]} timeZone={settings.timeZone} dateField="scheduled_at" empty="" />
              </div>
            )}
            {!!stuck.data?.length && (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t.dashboard.stuckPosts}</h3>
                <PostList posts={stuck.data as PostRow[]} timeZone={settings.timeZone} dateField="scheduled_at" empty="" />
              </div>
            )}
            {!!accounts.data?.length && (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t.dashboard.accountsToRenew}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {accounts.data.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <NetworkBadge network={a.network} />
                      <Link href={`/clients/${a.client_id}`} className="hover:underline">
                        {(a.clients as { name: string } | null)?.name} · {a.display_name}
                      </Link>
                      <span className={a.status === "expired" ? "text-destructive" : "text-amber-600"}>
                        {t.accountStatuses[a.status as "expiring" | "expired"]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.recent}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostList posts={(recent.data ?? []) as PostRow[]} timeZone={settings.timeZone} dateField="published_at" empty={t.dashboard.noRecent} />
        </CardContent>
      </Card>
    </div>
  );
}
