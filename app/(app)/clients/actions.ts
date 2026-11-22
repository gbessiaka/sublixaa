"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form-status";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { splitList } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

const clientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).nullable(),
  description: z.string().trim().max(5000).nullable(),
  tone: z.string().trim().max(1000).nullable(),
  target_audience: z.string().trim().max(2000).nullable(),
  goals: z.string().trim().max(2000).nullable(),
  products: z.string().trim().max(5000).nullable(),
  words_to_use: z.array(z.string().max(100)).max(100),
  words_to_avoid: z.array(z.string().max(100)).max(100),
  hashtags: z.array(z.string().max(100)).max(100),
  language: z.enum(["fr", "en", "es"]),
  examples: z.array(z.string().max(5000)).max(5),
});

function optional(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

// Lit le formulaire de fiche client (F-06, F-07)
function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    industry: optional(formData.get("industry")),
    description: optional(formData.get("description")),
    tone: optional(formData.get("tone")),
    target_audience: optional(formData.get("target_audience")),
    goals: optional(formData.get("goals")),
    products: optional(formData.get("products")),
    words_to_use: splitList(formData.get("words_to_use")),
    words_to_avoid: splitList(formData.get("words_to_avoid")),
    hashtags: splitList(formData.get("hashtags"), /[,\s]+/).map((h) => h.replace(/^#+/, "")),
    language: String(formData.get("language") ?? "fr"),
    examples: formData
      .getAll("examples")
      .map((e) => String(e).trim())
      .filter(Boolean),
  });
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const parsed = parseClientForm(formData);
  if (!parsed.success) return { error: t.clients.errors.nameRequired };

  const { data, error } = await ctx.supabase
    .from("clients")
    .insert({ ...parsed.data, owner_id: ctx.user.id })
    .select("id")
    .single();
  if (error) return { error: t.common.unknownError };
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const parsed = parseClientForm(formData);
  if (!parsed.success) return { error: t.clients.errors.nameRequired };

  const { error } = await ctx.supabase.from("clients").update(parsed.data).eq("id", clientId);
  if (error) return { error: t.common.unknownError };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true, message: t.common.saved };
}

// F-05 : archiver ou désarchiver
export async function setClientArchivedAction(clientId: string, archived: boolean) {
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return;
  await ctx.supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", clientId);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
