import { z } from "zod";

// Schémas Zod des sorties de l'IA (règle 8). Les limites métier (longueur par
// réseau, mots à éviter) sont vérifiées à part, dans checks.ts.

export const strategySchema = z.object({
  pillars: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        share: z.number().int().min(0).max(100),
      }),
    )
    .min(3)
    .max(5),
  // Nombre de publications par semaine pour chaque réseau
  frequency: z.array(z.object({ network: z.string(), per_week: z.number().int().min(0).max(14) })),
  theme_ideas: z.array(z.string().min(1)).min(10).max(20),
});
export type StrategyOutput = z.infer<typeof strategySchema>;

const postVersionSchema = z.object({
  network: z.string(),
  body: z.string().min(1),
  hashtags: z.array(z.string()),
  visual_idea: z.string(),
});

export const postSchema = z.object({
  versions: z.array(postVersionSchema).min(1),
});
export type PostOutput = z.infer<typeof postSchema>;

export const calendarSchema = z.object({
  posts: z
    .array(
      postVersionSchema.extend({
        // Date et heure locales dans le fuseau du propriétaire : "2026-12-03T09:30"
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        pillar: z.string(),
        topic: z.string().min(1),
      }),
    )
    .min(1),
});
export type CalendarOutput = z.infer<typeof calendarSchema>;

export const regenerateSchema = z.object({
  body: z.string().min(1),
  hashtags: z.array(z.string()),
});
export type RegenerateOutput = z.infer<typeof regenerateSchema>;
