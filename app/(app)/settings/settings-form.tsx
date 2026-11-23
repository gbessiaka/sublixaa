"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";

export function SettingsForm({
  t,
  action,
  initial,
}: {
  t: Dictionary;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: { timezone: string };
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
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
