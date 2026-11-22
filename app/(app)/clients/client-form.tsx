"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  t: Dictionary;
  client?: Tables<"clients">;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Formulaire de fiche marque (F-06) et d'exemples (F-07)
export function ClientForm({ t, client, action }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const f = t.clients.fields;
  const examples = Array.from({ length: 5 }, (_, i) => client?.examples[i] ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label={f.name}>
          <Input id="name" name="name" required maxLength={200} defaultValue={client?.name} />
        </Field>
        <Field id="industry" label={f.industry}>
          <Input id="industry" name="industry" defaultValue={client?.industry ?? ""} />
        </Field>
      </div>
      <Field id="description" label={f.description}>
        <Textarea id="description" name="description" rows={3} defaultValue={client?.description ?? ""} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="tone" label={f.tone}>
          <Input id="tone" name="tone" placeholder={f.tonePlaceholder} defaultValue={client?.tone ?? ""} />
        </Field>
        <Field id="language" label={f.language}>
          <NativeSelect id="language" name="language" defaultValue={client?.language ?? "fr"}>
            {Object.entries(t.clients.languages).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="target_audience" label={f.targetAudience}>
        <Textarea id="target_audience" name="target_audience" rows={2} defaultValue={client?.target_audience ?? ""} />
      </Field>
      <Field id="goals" label={f.goals}>
        <Textarea id="goals" name="goals" rows={2} defaultValue={client?.goals ?? ""} />
      </Field>
      <Field id="products" label={f.products}>
        <Textarea id="products" name="products" rows={3} defaultValue={client?.products ?? ""} />
      </Field>
      <div className="grid gap-5 md:grid-cols-3">
        <Field id="words_to_use" label={f.wordsToUse} hint={f.listHint}>
          <Input id="words_to_use" name="words_to_use" defaultValue={client?.words_to_use.join(", ")} />
        </Field>
        <Field id="words_to_avoid" label={f.wordsToAvoid} hint={f.listHint}>
          <Input id="words_to_avoid" name="words_to_avoid" defaultValue={client?.words_to_avoid.join(", ")} />
        </Field>
        <Field id="hashtags" label={f.hashtags} hint={f.listHint}>
          <Input id="hashtags" name="hashtags" defaultValue={client?.hashtags.join(", ")} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{f.examples}</legend>
        {examples.map((example, i) => (
          <Textarea
            key={i}
            name="examples"
            rows={2}
            aria-label={interpolate(f.example, { n: String(i + 1) })}
            placeholder={interpolate(f.example, { n: String(i + 1) })}
            defaultValue={example}
          />
        ))}
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.pending}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
