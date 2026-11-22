"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-status";
import { AI_MODELS, isAiProvider } from "@/lib/ai/config";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { isValidTimeZone } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";

// F-37 : fournisseur et modèle d'IA, fuseau horaire
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const provider = String(formData.get("ai_provider") ?? "");
  const model = String(formData.get("ai_model") ?? "");
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!isAiProvider(provider) || !AI_MODELS[provider].some((m) => m.id === model)) return { error: t.common.unknownError };
  if (!isValidTimeZone(timezone)) return { error: t.settings.timezoneInvalid };

  const { error } = await ctx.supabase
    .from("owner_settings")
    .upsert({ owner_id: ctx.user.id, ai_provider: provider, ai_model: model, timezone }, { onConflict: "owner_id" });
  if (error) return { error: t.common.unknownError };
  revalidatePath("/", "layout");
  return { ok: true, message: t.settings.saved };
}
