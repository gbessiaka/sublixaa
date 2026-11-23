import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";
import type { AiProvider } from "./config";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type RawResult = {
  // Texte brut renvoyé par le modèle (JSON attendu)
  text: string;
  inputTokens: number;
  outputTokens: number;
};

// Appel unique au fournisseur choisi, en demandant une sortie JSON conforme au schéma.
// Appels serveur uniquement (NF-04) ; les clés viennent des variables d'environnement.
export async function callProvider(params: {
  provider: AiProvider;
  model: string;
  system: string;
  turns: ChatTurn[];
  schema: z.ZodType;
  maxTokens: number;
}): Promise<RawResult> {
  const { provider, model, system, turns, schema, maxTokens } = params;

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 });
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      // Prompt système identique d'un appel à l'autre pour profiter de la mise en cache
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: turns,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new Error("Le service de rédaction a refusé la demande.");
    if (response.stop_reason === "max_tokens") throw new Error("Texte incomplet (longueur maximale atteinte).");
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const u = response.usage;
    return {
      text,
      inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      outputTokens: u.output_tokens,
    };
  }

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000 });
    const response = await client.chat.completions.create({
      model,
      max_completion_tokens: maxTokens,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...turns],
    });
    const choice = response.choices[0];
    if (choice?.finish_reason === "length") throw new Error("Texte incomplet (longueur maximale atteinte).");
    return {
      text: choice?.message.content ?? "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  // Délai maximal : en cas de forte demande, Google peut garder la connexion ouverte sans répondre
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 120_000 } });
  const response = await client.models.generateContent({
    model,
    contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
    },
  });
  return {
    text: response.text ?? "",
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens:
      (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}

export function providerApiKeyConfigured(provider: AiProvider): boolean {
  const name = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", google: "GEMINI_API_KEY" }[provider];
  return Boolean(process.env[name]);
}
