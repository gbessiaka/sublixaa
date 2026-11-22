import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOwnerContext } from "@/lib/auth/session";
import { getDictionary, interpolate } from "@/lib/i18n";

// F-04 : liste des clients avec logo, nom et nombre de publications programmées
export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const t = getDictionary();
  const { supabase } = await getOwnerContext();
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  let query = supabase.from("clients").select("id, name, industry, logo_url, archived_at").order("name");
  if (!showArchived) query = query.is("archived_at", null);
  const [{ data: clients }, { data: scheduled }] = await Promise.all([
    query,
    supabase.from("posts").select("client_id").eq("status", "scheduled"),
  ]);
  const counts = new Map<string, number>();
  for (const p of scheduled ?? []) counts.set(p.client_id, (counts.get(p.client_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.clients.title}</h1>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={showArchived ? "/clients" : "/clients?archived=1"}>
              {showArchived ? t.clients.hideArchived : t.clients.showArchived}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clients/new">{t.clients.new}</Link>
          </Button>
        </div>
      </div>
      {!clients?.length ? (
        <p className="text-muted-foreground">{t.clients.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardHeader className="flex flex-row items-center gap-3">
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <CardTitle>{c.name}</CardTitle>
                    {c.industry && <p className="text-sm text-muted-foreground">{c.industry}</p>}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{interpolate(t.clients.scheduledCount, { count: String(counts.get(c.id) ?? 0) })}</span>
                  {c.archived_at && <Badge>{t.clients.archived}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
