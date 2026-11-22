"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";

export function SettingsForm({
  t,
  action,
  models,
  keys,
  initial,
}: {
  t: Dictionary;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  models: Record<string, { id: string; inputPerMTok: number; outputPerMTok: number }[]>;
  keys: Record<string, boolean>;
  initial: { provider: string; model: string; timezone: string };
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [provider, setProvider] = useState(initial.provider);
  const list = models[provider] ?? [];
  const providers = t.settings.providers as Record<string, string>;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ai_provider">{t.settings.provider}</Label>
        <NativeSelect id="ai_provider" name="ai_provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {Object.keys(models).map((p) => (
            <option key={p} value={p}>
              {providers[p] ?? p}
            </option>
          ))}
        </NativeSelect>
        {!keys[provider] && <p className="text-sm text-amber-700">{t.settings.keyMissing}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ai_model">{t.settings.model}</Label>
        <NativeSelect key={provider} id="ai_model" name="ai_model" defaultValue={list.some((m) => m.id === initial.model) ? initial.model : list[0]?.id}>
          {list.map((m) => (
            <option key={m.id} value={m.id}>
              {interpolate(t.settings.priceLine, { model: m.id, input: String(m.inputPerMTok), output: String(m.outputPerMTok) })}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone">{t.settings.timezone}</Label>
        <Input id="timezone" name="timezone" defaultValue={initial.timezone} required />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.pending}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
