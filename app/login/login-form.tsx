"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { login, type LoginState } from "./actions";

type Props = {
  t: Dictionary["auth"];
  initialError?: string;
};

export function LoginForm({ t, initialError }: Props) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    initialError ? { error: initialError } : undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t.passwordLabel}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}

      <Button type="submit" name="intent" value="password" disabled={pending}>
        {pending ? t.pending : t.passwordSubmit}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="submit"
        name="intent"
        value="magic"
        variant="outline"
        formNoValidate
        disabled={pending}
      >
        {t.magicLinkSubmit}
      </Button>
    </form>
  );
}
