import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODEL, isAiProvider, type AiProvider } from "@/lib/ai/config";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

export type OwnerSettings = { timeZone: string; aiProvider: AiProvider; aiModel: string };

// Paramètres du propriétaire (F-37).
// Le service de rédaction est choisi uniquement par l'exploitant (AI_PROVIDER, AI_MODEL) :
// il n'est jamais affiché ni modifiable dans l'interface.
export async function getOwnerSettings(supabase: SupabaseClient<Database>, ownerId: string): Promise<OwnerSettings> {
  const { data } = await supabase.from("owner_settings").select("timezone").eq("owner_id", ownerId).maybeSingle();
  const envProvider = process.env.AI_PROVIDER;
  const aiProvider: AiProvider = isAiProvider(envProvider) ? envProvider : "anthropic";
  const aiModel = process.env.AI_MODEL || DEFAULT_MODEL[aiProvider];
  return { timeZone: data?.timezone || DEFAULT_TIMEZONE, aiProvider, aiModel };
}
