import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { estimateCost, type AiProvider } from "./config";
import { callProvider, type ChatTurn } from "./providers";

export type AiContext = {
  supabase: SupabaseClient<Database>;
  ownerId: string;
  provider: AiProvider;
  model: string;
};

export type GenerationKind = "strategy" | "calendar" | "post" | "regenerate";

export class AiGenerationError extends Error {}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  return JSON.parse(cleaned);
}

// Génère une sortie structurée : validation Zod + vérifications métier.
// En cas d'échec : une seule relance avec les erreurs, puis échec propre (règle 8).
// Chaque appel est enregistré dans ai_generations (F-19).
export async function runStructured<S extends z.ZodType>(
  ctx: AiContext,
  params: {
    kind: GenerationKind;
    system: string;
    prompt: string;
    schema: S;
    maxTokens?: number;
    check?: (data: z.infer<S>) => string[];
    // Au 2e essai, renvoyer quand même une sortie conforme au schéma malgré des erreurs métier
    // (l'appelant écarte alors les éléments invalides, ex. calendrier)
    lenientLastAttempt?: boolean;
    log?: { clientId?: string | null; postId?: string | null; strategyId?: string | null };
  },
): Promise<z.infer<S>> {
  const turns: ChatTurn[] = [{ role: "user", content: params.prompt }];
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    let rawText = "";
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const result = await callProvider({
        provider: ctx.provider,
        model: ctx.model,
        system: params.system,
        turns,
        schema: params.schema,
        maxTokens: params.maxTokens ?? 16000,
      });
      rawText = result.text;
      usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    } catch (error) {
      // Le détail (fournisseur, quota…) reste côté serveur : journal et ai_generations, jamais l'écran
      const detail = error instanceof Error ? error.message : String(error);
      console.error("Service de rédaction indisponible :", detail);
      await logGeneration(ctx, params, usage, false, detail);
      throw new AiGenerationError("service momentanément indisponible, réessayez dans quelques minutes.");
    }

    let errors: string[] = [];
    let data: z.infer<S> | undefined;
    try {
      const parsed = params.schema.safeParse(extractJson(rawText));
      if (parsed.success) {
        data = parsed.data;
        errors = params.check ? params.check(parsed.data) : [];
      } else {
        errors = parsed.error.issues.map((i) => `${i.path.join(".") || "racine"} : ${i.message}`);
      }
    } catch {
      errors = ["La réponse n'est pas un JSON valide."]; // message renvoyé au service, pas affiché tel quel
    }

    await logGeneration(ctx, params, usage, errors.length === 0, errors.length ? errors.join(" | ").slice(0, 2000) : null);
    if (errors.length === 0 && data !== undefined) return data;
    if (attempt === 1 && params.lenientLastAttempt && data !== undefined) return data;

    lastErrors = errors;
    // Relance unique : on renvoie la réponse précédente et la liste des erreurs
    turns.push(
      { role: "assistant", content: rawText || "(réponse vide)" },
      {
        role: "user",
        content: `Ta réponse ne respecte pas les contraintes :\n- ${errors.slice(0, 30).join("\n- ")}\n\nCorrige-la et renvoie l'objet JSON complet.`,
      },
    );
  }

  // Erreurs de forme (JSON, schéma) remplacées par un message neutre ; les contraintes métier restent lisibles
  const readable = lastErrors.filter((e) => !/JSON|racine|^[\w.]+ : /.test(e));
  throw new AiGenerationError(readable.length ? readable.slice(0, 5).join(" ") : "la proposition reçue était incomplète, réessayez.");
}

async function logGeneration(
  ctx: AiContext,
  params: { kind: GenerationKind; log?: { clientId?: string | null; postId?: string | null; strategyId?: string | null } },
  usage: { inputTokens: number; outputTokens: number },
  success: boolean,
  error: string | null,
) {
  const { error: dbError } = await ctx.supabase.from("ai_generations").insert({
    owner_id: ctx.ownerId,
    client_id: params.log?.clientId ?? null,
    post_id: params.log?.postId ?? null,
    strategy_id: params.log?.strategyId ?? null,
    kind: params.kind,
    provider: ctx.provider,
    model: ctx.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: estimateCost(ctx.model, usage.inputTokens, usage.outputTokens),
    success,
    error,
  });
  if (dbError) console.error("Journalisation ai_generations impossible :", dbError.message);
}
