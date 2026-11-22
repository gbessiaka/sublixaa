import { fr } from "./fr";

// Structure commune à toutes les langues (fr sert de référence)
export type Dictionary = typeof fr;

// Pour le MVP, une seule langue ; l'anglais s'ajoutera ici sans toucher aux composants
export function getDictionary(): Dictionary {
  return fr;
}

// Remplace les variables {nom} d'un texte par leur valeur
export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
