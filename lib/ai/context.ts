import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerSettings } from "@/lib/settings";
import type { Database } from "@/lib/supabase/database.types";
import { providerApiKeyConfigured } from "./providers";
import type { AiContext } from "./run";

// Contexte d'appel à l'IA, ou null si la clé du fournisseur choisi est absente
export function buildAiContext(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  settings: OwnerSettings,
): AiContext | null {
  if (!providerApiKeyConfigured(settings.aiProvider)) return null;
  return { supabase, ownerId, provider: settings.aiProvider, model: settings.aiModel };
}
