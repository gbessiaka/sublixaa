"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function GenerateStrategyForm({
  t,
  action,
  networks,
  defaultNetworks,
  defaultGoal,
  hasStrategy,
}: {
  t: Dictionary;
  action: Action;
  networks: string[];
  defaultNetworks: string[];
  defaultGoal: string;
  hasStrategy: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const labels = t.networks as Record<string, string>;
  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        if (hasStrategy && !window.confirm(t.strategy.regenerateConfirm)) e.preventDefault();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.strategy.networks}</legend>
        <div className="flex flex-wrap gap-3">
          {networks.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="networks" value={n} defaultChecked={defaultNetworks.includes(n)} className="size-4" />
              {labels[n] ?? n}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="monthly_goal_gen">{t.strategy.monthlyGoal}</Label>
        <Input id="monthly_goal_gen" name="monthly_goal" defaultValue={defaultGoal} />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.generating}>{hasStrategy ? t.strategy.regenerate : t.strategy.generate}</SubmitButton>
      </div>
    </form>
  );
}

type Pillar = { name: string; description: string; share: number };

export function StrategyEditor({
  t,
  action,
  pillars,
  frequency,
  themeIdeas,
  monthlyGoal,
}: {
  t: Dictionary;
  action: Action;
  pillars: Pillar[];
  frequency: Record<string, number>;
  themeIdeas: string[];
  monthlyGoal: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const initialRows = pillars.length ? pillars : [{ name: "", description: "", share: 0 }];
  const [rows, setRows] = useState<Pillar[]>(initialRows);
  // Nouvelle stratégie renvoyée par le serveur (ex. régénération) : on recharge les piliers
  const serverKey = JSON.stringify(pillars);
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (serverKey !== lastServerKey) {
    setLastServerKey(serverKey);
    setRows(initialRows);
  }
  const labels = t.networks as Record<string, string>;
  const total = rows.reduce((s, r) => s + (Number(r.share) || 0), 0);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="monthly_goal">{t.strategy.monthlyGoal}</Label>
        <Input id="monthly_goal" name="monthly_goal" defaultValue={monthlyGoal} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t.strategy.pillars}</legend>
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_2fr_6rem]">
            <Input
              name="pillar_name"
              aria-label={t.strategy.pillarName}
              placeholder={t.strategy.pillarName}
              value={row.name}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            />
            <Input
              name="pillar_description"
              aria-label={t.strategy.pillarDescription}
              placeholder={t.strategy.pillarDescription}
              value={row.description}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
            />
            <Input
              name="pillar_share"
              type="number"
              min={0}
              max={100}
              aria-label={t.strategy.pillarShare}
              value={row.share}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, share: Number(e.target.value) } : r)))}
            />
          </div>
        ))}
        <div className="flex items-center gap-4">
          {rows.length < 5 && (
            <button type="button" className="text-sm underline" onClick={() => setRows([...rows, { name: "", description: "", share: 0 }])}>
              {t.strategy.addPillar}
            </button>
          )}
          <span className={total === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {interpolate(t.strategy.sharesTotal, { total: String(total) })}
          </span>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.strategy.frequency}</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(frequency).map(([network, perWeek]) => (
            <label key={network} className="flex items-center gap-2 text-sm">
              {labels[network] ?? network}
              <Input name={`freq_${network}`} type="number" min={0} max={14} defaultValue={perWeek} className="w-20" />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="theme_ideas">{t.strategy.themeIdeas}</Label>
        <Textarea id="theme_ideas" name="theme_ideas" rows={10} defaultValue={themeIdeas.join("\n")} />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.pending}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}

export function GenerateCalendarForm({ t, action }: { t: Dictionary; action: (prev: ActionState) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm(t.strategy.generateCalendarConfirm)) e.preventDefault();
      }}
    >
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.generating}>{t.strategy.generateCalendar}</SubmitButton>
      </div>
    </form>
  );
}
