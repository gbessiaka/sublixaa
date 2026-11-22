// Fournisseurs et modèles d'IA disponibles (F-37). Aucun secret ici.

export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: string | null | undefined): value is AiProvider {
  return !!value && (AI_PROVIDERS as readonly string[]).includes(value);
}

// Modèles proposés dans les paramètres. Prix en dollars US par million de jetons
// (entrée / sortie). À revérifier sur les pages de prix des fournisseurs.
export const AI_MODELS: Record<AiProvider, { id: string; inputPerMTok: number; outputPerMTok: number }[]> = {
  anthropic: [
    { id: "claude-haiku-5-5", inputPerMTok: 0.1, outputPerMTok: 0.5 },
    { id: "claude-sonnet-5-5", inputPerMTok: 2, outputPerMTok: 10 },
    { id: "claude-opus-5-5", inputPerMTok: 4, outputPerMTok: 20 },
  ],
  openai: [
    { id: "gpt-5-mini", inputPerMTok: 0.25, outputPerMTok: 2 },
    { id: "gpt-5-nano", inputPerMTok: 0.05, outputPerMTok: 0.4 },
  ],
  google: [
    { id: "gemini-2.5-flash", inputPerMTok: 0.3, outputPerMTok: 2.5 },
    { id: "gemini-2.5-flash-lite", inputPerMTok: 0.1, outputPerMTok: 0.4 },
  ],
};

// Modèle léger par défaut pour chaque fournisseur (cahier, section 5)
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5-mini",
  google: "gemini-2.5-flash",
};

// Coût estimé d'un appel ; null si le modèle n'est pas dans la table
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  for (const list of Object.values(AI_MODELS)) {
    const m = list.find((x) => x.id === model);
    if (m) return (inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000;
  }
  return null;
}
