import { composeText, getRules, normalizeHashtag, textLength } from "@/lib/network-rules";

// Vérifications métier après génération : limites du réseau et mots à éviter.
// Renvoie une liste d'erreurs lisibles, transmises au modèle lors de la relance.
export function checkPostVersion(
  version: { network: string; body: string; hashtags: string[] },
  wordsToAvoid: readonly string[],
  label = version.network,
): string[] {
  const errors: string[] = [];
  const rules = getRules(version.network);
  if (!rules) return [`${label} : réseau inconnu « ${version.network} »`];
  const tags = version.hashtags.map(normalizeHashtag).filter(Boolean);
  const length = textLength(composeText(version.body, tags));
  if (length > rules.maxLength) {
    errors.push(`${label} : ${length} caractères, la limite est ${rules.maxLength}. Raccourcis le texte.`);
  }
  if (rules.maxHashtags !== null && tags.length > rules.maxHashtags) {
    errors.push(`${label} : ${tags.length} hashtags, la limite est ${rules.maxHashtags}.`);
  }
  const haystack = `${version.body} ${tags.join(" ")}`.toLowerCase();
  for (const word of wordsToAvoid) {
    const w = word.trim().toLowerCase();
    if (w && haystack.includes(w)) errors.push(`${label} : contient le mot à éviter « ${word} ».`);
  }
  return errors;
}
