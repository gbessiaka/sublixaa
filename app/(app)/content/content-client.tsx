"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/form-status";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import { getRules } from "@/lib/network-rules";
import { STATUS_COLORS, isPostStatus } from "@/lib/posts";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function NewPostForm({
  t,
  action,
  clients,
  networks,
}: {
  t: Dictionary;
  action: Action;
  clients: { id: string; name: string }[];
  networks: string[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const labels = t.networks as Record<string, string>;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="client_id">{t.content.client}</Label>
          <NativeSelect id="client_id" name="client_id" required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="topic">{t.content.topic}</Label>
          <Input id="topic" name="topic" required maxLength={1000} placeholder={t.content.topicPlaceholder} />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.content.networks}</legend>
        <div className="flex flex-wrap gap-3">
          {networks.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="networks" value={n} className="size-4" />
              {labels[n] ?? n}
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={t.common.generating}>{t.content.generate}</SubmitButton>
      </div>
    </form>
  );
}

type Row = { id: string; date: string | null; client: string; network: string; text: string; status: string };

// Liste des publications avec sélection multiple pour programmer d'un coup (F-27)
export function PostTable({ t, rows, action }: { t: Dictionary; rows: Row[]; action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const labels = t.networks as Record<string, string>;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (!rows.length) return <p className="text-muted-foreground">{t.content.empty}</p>;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{interpolate(t.content.selected, { count: String(selected.length) })}</span>
        <SubmitButton size="sm" disabled={!selected.length} pendingLabel={t.common.pending}>
          {t.content.scheduleSelected}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="w-8 p-2">
                <input
                  type="checkbox"
                  aria-label={t.common.all}
                  className="size-4"
                  checked={selected.length === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th className="p-2">{t.content.columns.date}</th>
              <th className="p-2">{t.content.columns.client}</th>
              <th className="p-2">{t.content.columns.network}</th>
              <th className="p-2">{t.content.columns.text}</th>
              <th className="p-2">{t.content.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top hover:bg-muted/30">
                <td className="p-2">
                  <input
                    type="checkbox"
                    name="post_id"
                    value={r.id}
                    className="size-4"
                    checked={selected.includes(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={r.text.slice(0, 40)}
                  />
                </td>
                <td className="whitespace-nowrap p-2">{r.date ?? <span className="text-muted-foreground">{t.content.notScheduled}</span>}</td>
                <td className="whitespace-nowrap p-2">{r.client}</td>
                <td className="p-2">
                  <Badge color={getRules(r.network)?.color}>{labels[r.network] ?? r.network}</Badge>
                </td>
                <td className="max-w-md p-2">
                  <Link href={`/content/${r.id}`} className="line-clamp-2 hover:underline">
                    {r.text || "—"}
                  </Link>
                </td>
                <td className="p-2">
                  {isPostStatus(r.status) ? <Badge color={STATUS_COLORS[r.status]}>{t.statuses[r.status]}</Badge> : r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
