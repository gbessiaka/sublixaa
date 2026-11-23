import { CircleCheck, CircleDashed, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, monthLabel, monthToDate } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { PageHeader } from "../page-header";

// Accès rapide à la stratégie du mois de chaque client (F-13 à F-15)
export default async function StrategyHubPage() {
  const t = getDictionary();
  const { supabase, settings } = await getOwnerContext();
  const month = currentMonth(settings.timeZone);

  const [{ data: clients }, { data: strategies }] = await Promise.all([
    supabase.from("clients").select("id, name, industry").is("archived_at", null).order("name"),
    supabase.from("strategies").select("client_id, status").eq("month", monthToDate(month)),
  ]);
  const validated = new Set((strategies ?? []).filter((s) => s.status === "validated").map((s) => s.client_id));
  const label = monthLabel(month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.strategyHub.title} subtitle={t.strategyHub.subtitle} />
      {!clients?.length ? (
        <p className="text-muted-foreground">{t.clients.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const ok = validated.has(c.id);
            return (
              <Link key={c.id} href={`/clients/${c.id}/strategy`}>
                <Card className="gap-3 p-5 transition-shadow hover:shadow-md">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    {c.industry && <p className="text-sm text-muted-foreground">{c.industry}</p>}
                  </div>
                  <p className={ok ? "flex items-center gap-2 text-sm text-emerald-700" : "flex items-center gap-2 text-sm text-muted-foreground"}>
                    {ok ? <CircleCheck className="size-4" /> : <CircleDashed className="size-4" />}
                    {interpolate(ok ? t.strategyHub.validated : t.strategyHub.none, { month: label })}
                  </p>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    {t.strategyHub.open}
                    <ChevronRight className="size-4" />
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
