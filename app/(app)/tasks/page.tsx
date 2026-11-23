import Link from "next/link";
import { PostList, type PostListRow } from "@/components/post-list";
import { NetworkBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { PageHeader } from "../page-header";

// Tout ce qui demande une action : validation, échecs, blocages, connexions (F-34, F-35)
export default async function TasksPage() {
  const t = getDictionary();
  const { supabase, settings } = await getOwnerContext();
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const select = "id, scheduled_at, published_at, network, body, topic, status, error_message, clients(name)";

  const [toReview, failed, stuck, accounts] = await Promise.all([
    supabase.from("posts").select(select).eq("status", "to_review").order("scheduled_at", { nullsFirst: false }).limit(100),
    supabase.from("posts").select(select).eq("status", "failed").order("scheduled_at", { ascending: false }),
    supabase.from("posts").select(select).eq("status", "publishing").lt("updated_at", stuckBefore.toISOString()),
    supabase.from("social_accounts").select("id, client_id, network, display_name, status, clients(name)").in("status", ["expiring", "expired"]),
  ]);

  const sections = [
    { title: t.dashboard.failedPosts, rows: (failed.data ?? []) as PostListRow[] },
    { title: t.dashboard.stuckPosts, rows: (stuck.data ?? []) as PostListRow[] },
  ].filter((s) => s.rows.length);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.tasks.title} subtitle={t.tasks.subtitle} />

      {sections.map((s) => (
        <Card key={s.title} className="border-destructive/30">
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <PostList posts={s.rows} timeZone={settings.timeZone} dateField="scheduled_at" />
          </CardContent>
        </Card>
      ))}

      {!!accounts.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.accountsToRenew}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.tasks.toReview}</CardTitle>
        </CardHeader>
        <CardContent>
          {toReview.data?.length ? (
            <PostList posts={toReview.data as PostListRow[]} timeZone={settings.timeZone} dateField="scheduled_at" />
          ) : (
            <p className="text-sm text-muted-foreground">{t.tasks.noToReview}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
