import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { getOwnerContext } from "@/lib/auth/session";
import { formatInTz } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";
import { NETWORK_IDS, isNetworkId } from "@/lib/network-rules";
import { POST_STATUSES, isPostStatus } from "@/lib/posts";
import { generatePostAction, scheduleManyAction } from "./actions";
import { NewPostForm, PostTable } from "./content-client";

export default async function ContentPage({ searchParams }: PageProps<"/content">) {
  const t = getDictionary();
  const sp = await searchParams;
  const { supabase, settings } = await getOwnerContext();
  const client = typeof sp.client === "string" ? sp.client : "";
  const network = typeof sp.network === "string" && isNetworkId(sp.network) ? sp.network : "";
  const status = typeof sp.status === "string" && isPostStatus(sp.status) ? sp.status : "";

  let query = supabase
    .from("posts")
    .select("id, scheduled_at, network, body, status, clients(name)")
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(300);
  if (client) query = query.eq("client_id", client);
  if (network) query = query.eq("network", network);
  if (status) query = query.eq("status", status);

  const [{ data: posts }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
  ]);
  const rows = (posts ?? []).map((p) => ({
    id: p.id,
    date: p.scheduled_at ? formatInTz(p.scheduled_at, settings.timeZone, "d MMM yyyy HH:mm") : null,
    client: (p.clients as { name: string } | null)?.name ?? "",
    network: p.network,
    text: p.body,
    status: p.status,
  }));
  const labels = t.networks as Record<string, string>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.content.title}</h1>
      {clients?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.content.newTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <NewPostForm t={t} action={generatePostAction} clients={clients} networks={NETWORK_IDS} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">{t.clients.empty}</p>
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
          {t.content.filters.client}
          <NativeSelect name="client" defaultValue={client} className="w-48">
            <option value="">{t.common.all}</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.content.filters.network}
          <NativeSelect name="network" defaultValue={network} className="w-44">
            <option value="">{t.common.all}</option>
            {NETWORK_IDS.map((n) => (
              <option key={n} value={n}>
                {labels[n]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.content.filters.status}
          <NativeSelect name="status" defaultValue={status} className="w-44">
            <option value="">{t.common.all}</option>
            {POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.statuses[s]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline">
          {t.common.filter}
        </Button>
      </form>

      <PostTable key={JSON.stringify(sp)} t={t} rows={rows} action={scheduleManyAction} />
    </div>
  );
}
