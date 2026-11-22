import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_MODELS, AI_PROVIDERS } from "@/lib/ai/config";
import { providerApiKeyConfigured } from "@/lib/ai/providers";
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
    .select("cost_usd, input_tokens, output_tokens")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  const cost = (gens ?? []).reduce((s, g) => s + Number(g.cost_usd ?? 0), 0);
  const tokens = (gens ?? []).reduce((s, g) => s + g.input_tokens + g.output_tokens, 0);
  const keys = Object.fromEntries(AI_PROVIDERS.map((p) => [p, providerApiKeyConfigured(p)]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.ai}</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            t={t}
            action={saveSettingsAction}
            models={AI_MODELS}
            keys={keys}
            initial={{ provider: settings.aiProvider, model: settings.aiModel, timezone: settings.timeZone }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.costTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {interpolate(t.settings.costLine, {
              cost: cost.toFixed(4),
              count: String(gens?.length ?? 0),
              tokens: tokens.toLocaleString("fr-CA"),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
