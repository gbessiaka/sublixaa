"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

// Bouton d'envoi qui se désactive pendant l'action serveur
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

// Message de retour d'une action (erreur ou succès)
export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="text-sm text-green-700">
        {state.message}
      </p>
    );
  }
  return null;
}
