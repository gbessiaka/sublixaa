"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import { composeText, getRules, normalizeHashtag, textLength } from "@/lib/network-rules";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// F-18 : édition avec compteur de caractères selon la limite du réseau
export function PostEditor({
  t,
  action,
  post,
  scheduledLocal,
  timeZone,
  accounts,
  locked,
}: {
  t: Dictionary;
  action: Action;
  post: { network: string; body: string; hashtags: string[]; topic: string | null; visual_idea: string | null; social_account_id: string | null };
  scheduledLocal: string;
  timeZone: string;
  accounts: { id: string; display_name: string | null }[];
  locked: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const serverHashtags = post.hashtags.join(" ");
  const [body, setBody] = useState(post.body);
  const [hashtags, setHashtags] = useState(serverHashtags);
  // Si le serveur renvoie un nouveau texte (ex. après régénération), on met à jour les champs
  const [lastServer, setLastServer] = useState({ body: post.body, hashtags: serverHashtags });
  if (lastServer.body !== post.body || lastServer.hashtags !== serverHashtags) {
    setLastServer({ body: post.body, hashtags: serverHashtags });
    setBody(post.body);
    setHashtags(serverHashtags);
  }
  const rules = getRules(post.network);
  const finalText = composeText(body, hashtags.split(/[\s,]+/).map(normalizeHashtag).filter(Boolean));
  const length = textLength(finalText);
  const over = rules ? length > rules.maxLength : false;
  const networkLabel = (t.networks as Record<string, string>)[post.network] ?? post.network;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={locked} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="body">{t.post.body}</Label>
          <Textarea id="body" name="body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hashtags">{t.post.hashtags}</Label>
          <Input id="hashtags" name="hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t.post.hashtagsHint}</p>
        </div>
        {rules && (
          <p className={over ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"} aria-live="polite">
            {interpolate(t.post.charCount, { count: String(length), max: String(rules.maxLength) })}
          </p>
        )}
        <details className="rounded-md border p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t.post.finalPreview}</summary>
          <p className="mt-2 whitespace-pre-wrap">{finalText}</p>
        </details>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled_at">{t.post.scheduledAt}</Label>
            <Input id="scheduled_at" name="scheduled_at" type="datetime-local" defaultValue={scheduledLocal} />
            <p className="text-xs text-muted-foreground">{interpolate(t.post.timezoneHint, { tz: timeZone })}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="social_account_id">{t.post.account}</Label>
            {accounts.length ? (
              <NativeSelect id="social_account_id" name="social_account_id" defaultValue={post.social_account_id ?? ""}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-sm text-muted-foreground">{interpolate(t.post.noAccount, { network: networkLabel })}</p>
            )}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic">{t.post.topic}</Label>
            <Input id="topic" name="topic" defaultValue={post.topic ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="visual_idea">{t.post.visualIdea}</Label>
            <Input id="visual_idea" name="visual_idea" defaultValue={post.visual_idea ?? ""} />
          </div>
        </div>
      </fieldset>
      <FormMessage state={state} />
      {!locked && (
        <div>
          <SubmitButton pendingLabel={t.common.pending}>{t.common.save}</SubmitButton>
        </div>
      )}
    </form>
  );
}

// Bouton d'action avec confirmation éventuelle et message de retour
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirm,
  variant = "outline",
}: {
  action: (prev: ActionState) => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  confirm?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function RegenerateForm({ t, action }: { t: Dictionary; action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="instruction">{t.post.regenerateInstruction}</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="instruction" name="instruction" placeholder={t.post.regeneratePlaceholder} className="min-w-48 flex-1" />
        <SubmitButton variant="secondary" pendingLabel={t.common.generating}>
          {t.post.regenerate}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function CopyTextButton({ text, t }: { text: string; t: Dictionary }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? t.post.copied : t.post.copyText}
    </Button>
  );
}
