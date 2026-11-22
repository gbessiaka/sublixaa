import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, formatInTz, monthLabel } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { NETWORK_IDS, getRules } from "@/lib/network-rules";
import { getPublisher, isPublisherConfigured } from "@/lib/publishers";
import { updateClientAction, setClientArchivedAction } from "../actions";
import { ClientForm } from "../client-form";
import { disconnectAccountAction } from "./accounts-actions";

const ACCOUNT_COLORS = { active: "#16a34a", expiring: "#f59e0b", expired: "#dc2626" } as const;

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const t = getDictionary();
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, settings } = await getOwnerContext();

  const [{ data: client }, { data: accounts }, { data: strategies }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("social_accounts").select("id, network, display_name, status, token_expires_at").eq("client_id", id).order("network"),
    supabase.from("strategies").select("month, status").eq("client_id", id).order("month", { ascending: false }).limit(6),
  ]);
  if (!client) notFound();

  const networksLabel = t.networks as Record<string, string>;
  const oauthError = typeof sp.oauth_error === "string" ? sp.oauth_error : null;
  const oauthMessage =
    oauthError === "denied"
      ? t.accounts.errors.denied
      : oauthError === "state"
        ? t.accounts.errors.state
        : oauthError === "no_accounts"
          ? t.accounts.errors.noAccounts
          : oauthError === "exchange"
            ? interpolate(t.accounts.errors.exchange, { message: String(sp.message ?? "") })
            : oauthError === "not_configured"
              ? interpolate(t.accounts.notConfigured, { network: networksLabel[String(sp.network)] ?? "" })
              : null;

  const thisMonth = currentMonth(settings.timeZone);
  const nextMonth = currentMonth(settings.timeZone, 1);
  const archive = setClientArchivedAction.bind(null, id, !client.archived_at);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          {client.archived_at && <Badge>{t.clients.archived}</Badge>}
        </div>
        <form action={archive}>
          <Button type="submit" variant="outline" size="sm">
            {client.archived_at ? t.clients.unarchive : t.clients.archive}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.clients.sections.accounts}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {oauthMessage && (
            <p role="alert" className="text-sm text-destructive">
              {oauthMessage}
            </p>
          )}
          {sp.connected && (
            <p role="status" className="text-sm text-green-700">
              {t.accounts.connected}
            </p>
          )}
          {!accounts?.length ? (
            <p className="text-sm text-muted-foreground">{t.accounts.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={getRules(a.network)?.color}>{networksLabel[a.network] ?? a.network}</Badge>
                    <span className="font-medium">{a.display_name}</span>
                    <Badge color={ACCOUNT_COLORS[a.status as keyof typeof ACCOUNT_COLORS]}>
                      {t.accountStatuses[a.status as keyof typeof t.accountStatuses]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {a.token_expires_at
                        ? interpolate(t.accounts.expiresOn, { date: formatInTz(a.token_expires_at, settings.timeZone) })
                        : t.accounts.noExpiry}
                    </span>
                  </div>
                  <form action={disconnectAccountAction.bind(null, a.id, id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      {t.accounts.disconnect}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {NETWORK_IDS.map((n) => {
              const publisher = getPublisher(n);
              if (!publisher) return null;
              const configured = isPublisherConfigured(publisher);
              return configured ? (
                <Button key={n} asChild variant="outline" size="sm">
                  <a href={`/api/oauth/${n}?clientId=${id}`}>{interpolate(t.accounts.connect, { network: networksLabel[n] })}</a>
                </Button>
              ) : (
                <Button key={n} variant="outline" size="sm" disabled title={interpolate(t.accounts.notConfigured, { network: networksLabel[n] })}>
                  {interpolate(t.accounts.connect, { network: networksLabel[n] })}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t.accounts.manualOnly}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.clients.sections.strategy}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[thisMonth, nextMonth].map((m) => {
            const s = strategies?.find((x) => x.month.startsWith(m));
            return (
              <Button key={m} asChild variant="outline">
                <Link href={`/clients/${id}/strategy?month=${m}`}>
                  {monthLabel(m)}
                  {s && <Badge className="ml-1">{t.strategy.status[s.status as "draft" | "validated"]}</Badge>}
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.clients.sections.export}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={`/api/export/${id}`} method="get" target="_blank" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="from">{t.export.from}</Label>
              <Input id="from" name="from" type="date" required defaultValue={`${thisMonth}-01`} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="to">{t.export.to}</Label>
              <Input id="to" name="to" type="date" required defaultValue={`${nextMonth}-01`} />
            </div>
            <Button type="submit">{t.export.download}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.clients.sections.profile}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm t={t} client={client} action={updateClientAction.bind(null, id)} />
        </CardContent>
      </Card>
    </div>
  );
}
