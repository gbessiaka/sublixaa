import { PageHeader } from "../page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth, monthRangeUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { saveSettingsAction } from "./actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const t = getDictionary();
  const { supabase, settings } = await getOwnerContext();
  const { start, end } = monthRangeUtc(currentMonth(settings.timeZone), settings.timeZone);
  const { data: gens } = await supabase
    .from("ai_generations")
    .select("cost_usd")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  const cost = (gens ?? []).reduce((s, g) => s + Number(g.cost_usd ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.settings.title} />
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.general}</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm t={t} action={saveSettingsAction} initial={{ timezone: settings.timeZone }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.costTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{interpolate(t.settings.costLine, { cost: cost.toFixed(2), count: String(gens?.length ?? 0) })}</p>
        </CardContent>
      </Card>
    </div>
  );
}
