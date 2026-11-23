"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-status";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { isValidTimeZone } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";

// F-37 : fuseau horaire (le service de rédaction est réglé par l'exploitant, hors interface)
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return { error: t.auth.errors.forbidden };
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!isValidTimeZone(timezone)) return { error: t.settings.timezoneInvalid };

  const { error } = await ctx.supabase
    .from("owner_settings")
    .upsert({ owner_id: ctx.user.id, timezone }, { onConflict: "owner_id" });
  if (error) return { error: t.common.unknownError };
  revalidatePath("/", "layout");
  return { ok: true, message: t.settings.saved };
}
