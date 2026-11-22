import { TZDate } from "@date-fns/tz";
import { addMonths, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { getOwnerContext } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { NETWORK_IDS, isNetworkId } from "@/lib/network-rules";
import { EDITABLE_STATUSES, POST_STATUSES, STATUS_COLORS, type PostStatus } from "@/lib/posts";
import { movePostAction } from "./actions";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const t = getDictionary();
  const sp = await searchParams;
  const { supabase, settings } = await getOwnerContext();
  const client = typeof sp.client === "string" ? sp.client : "";
  const network = typeof sp.network === "string" && isNetworkId(sp.network) ? sp.network : "";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : format(new TZDate(new Date(), settings.timeZone), "yyyy-MM-dd");

  // Fenêtre chargée : deux mois avant et après la date affichée
  const center = new Date(`${date}T12:00:00Z`);
  let query = supabase
    .from("posts")
    .select("id, scheduled_at, network, body, topic, status, clients(name)")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", addMonths(center, -2).toISOString())
    .lte("scheduled_at", addMonths(center, 2).toISOString());
  if (client) query = query.eq("client_id", client);
  if (network) query = query.eq("network", network);
  const [{ data: posts }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const labels = t.networks as Record<string, string>;
  const events = (posts ?? []).map((p) => ({
    id: p.id,
    start: format(new TZDate(new Date(p.scheduled_at!), settings.timeZone), "yyyy-MM-dd'T'HH:mm:ss"),
    title: `${labels[p.network] ?? p.network} · ${(p.clients as { name: string } | null)?.name ?? ""} · ${p.topic || p.body.slice(0, 40)}`,
    status: p.status,
    editable: EDITABLE_STATUSES.includes(p.status as PostStatus),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t.calendar.title}</h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <input type="hidden" name="date" value={date} />
        <NativeSelect name="client" defaultValue={client} className="w-48" aria-label={t.content.filters.client}>
          <option value="">{t.calendar.allClients}</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="network" defaultValue={network} className="w-44" aria-label={t.content.filters.network}>
          <option value="">{t.calendar.allNetworks}</option>
          {NETWORK_IDS.map((n) => (
            <option key={n} value={n}>
              {labels[n]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {t.common.filter}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{t.calendar.legend} :</span>
        {POST_STATUSES.map((s) => (
          <Badge key={s} color={STATUS_COLORS[s]}>
            {t.statuses[s]}
          </Badge>
        ))}
      </div>
      <CalendarView events={events} initialDate={date} move={movePostAction} />
      <p className="text-xs text-muted-foreground">{t.calendar.unscheduledHint}</p>
    </div>
  );
}
