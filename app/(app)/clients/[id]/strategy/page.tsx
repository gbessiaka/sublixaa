import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, monthLabel, monthToDate } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { NETWORK_IDS } from "@/lib/network-rules";
import { generateCalendarAction, generateStrategyAction, saveStrategyAction, setStrategyStatusAction } from "./actions";
import { GenerateCalendarForm, GenerateStrategyForm, StrategyEditor } from "./strategy-forms";

export default async function StrategyPage({ params, searchParams }: PageProps<"/clients/[id]/strategy">) {
  const t = getDictionary();
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, settings } = await getOwnerContext();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth(settings.timeZone);

  const [{ data: client }, { data: strategy }, { data: accounts }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("strategies").select("*").eq("client_id", id).eq("month", monthToDate(month)).maybeSingle(),
    supabase.from("social_accounts").select("network").eq("client_id", id),
  ]);
  if (!client) notFound();

  const connected = [...new Set((accounts ?? []).map((a) => a.network))];
  const frequency = (strategy?.frequency ?? {}) as Record<string, number>;
  const pillars = (strategy?.pillars ?? []) as { name: string; description: string; share: number }[];
  const themeIdeas = (strategy?.theme_ideas ?? []) as string[];
  const validated = strategy?.status === "validated";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/clients/${id}`} className="text-sm text-muted-foreground hover:underline">
            ← {client.name}
          </Link>
          <h1 className="text-2xl font-semibold">{interpolate(t.strategy.title, { month: monthLabel(month) })}</h1>
        </div>
        {strategy && <Badge color={validated ? "#16a34a" : undefined}>{t.strategy.status[validated ? "validated" : "draft"]}</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{strategy ? t.strategy.regenerate : t.strategy.generate}</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateStrategyForm
            t={t}
            action={generateStrategyAction.bind(null, id, month)}
            networks={NETWORK_IDS}
            defaultNetworks={strategy ? Object.keys(frequency) : connected}
            defaultGoal={strategy?.monthly_goal ?? ""}
            hasStrategy={Boolean(strategy)}
          />
        </CardContent>
      </Card>

      {!strategy ? (
        <p className="text-muted-foreground">{t.strategy.none}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t.clients.sections.strategy}</CardTitle>
            </CardHeader>
            <CardContent>
              <StrategyEditor
                t={t}
                action={saveStrategyAction.bind(null, strategy.id, id)}
                pillars={pillars}
                frequency={frequency}
                themeIdeas={themeIdeas}
                monthlyGoal={strategy.monthly_goal ?? ""}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <form action={setStrategyStatusAction.bind(null, strategy.id, id, validated ? "draft" : "validated")}>
                <Button type="submit" variant={validated ? "outline" : "default"}>
                  {validated ? t.strategy.unvalidate : t.strategy.validate}
                </Button>
              </form>
              {validated ? (
                <GenerateCalendarForm t={t} action={generateCalendarAction.bind(null, strategy.id, id)} />
              ) : (
                <p className="text-sm text-muted-foreground">{t.strategy.mustValidate}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
