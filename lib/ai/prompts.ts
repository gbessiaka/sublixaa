import { NETWORK_RULES, type NetworkId } from "@/lib/network-rules";
import type { Tables } from "@/lib/supabase/database.types";

export type ClientProfile = Tables<"clients">;

const LANGUAGE_NAMES: Record<string, string> = { fr: "français", en: "anglais", es: "espagnol" };

function list(values: readonly string[] | null | undefined): string {
  return values && values.length ? values.join(", ") : "(non précisé)";
}

// Prompt système : fiche marque complète, exemples du client et règles de TOUS les réseaux.
// Il est identique d'un appel à l'autre pour un même client (mise en cache du préfixe).
export function buildSystemPrompt(client: ClientProfile): string {
  const language = LANGUAGE_NAMES[client.language] ?? client.language;
  const examples = client.examples.length
    ? client.examples.map((e, i) => `<exemple numero="${i + 1}">\n${e}\n</exemple>`).join("\n")
    : "(aucun exemple fourni)";
  const rules = (Object.keys(NETWORK_RULES) as NetworkId[])
    .map((n) => {
      const r = NETWORK_RULES[n];
      const tags = r.maxHashtags === null ? "" : `, ${r.maxHashtags} hashtags au plus`;
      return `- ${n} : ${r.maxLength} caractères au plus (hashtags compris)${tags}. ${r.aiStyle}`;
    })
    .join("\n");

  return `Tu es un gestionnaire de communauté expérimenté qui rédige le contenu des réseaux sociaux d'une marque.
Tu écris toujours en ${language}, avec le ton de la marque, sans fautes, sans inventer de faits, de prix, de promotions ni de chiffres qui ne figurent pas dans la fiche.

<fiche_marque>
Nom : ${client.name}
Secteur : ${client.industry ?? "(non précisé)"}
Description : ${client.description ?? "(non précisé)"}
Ton : ${client.tone ?? "(non précisé)"}
Public cible : ${client.target_audience ?? "(non précisé)"}
Objectifs : ${client.goals ?? "(non précisé)"}
Produits ou services : ${client.products ?? "(non précisé)"}
Mots à utiliser : ${list(client.words_to_use)}
Mots à éviter absolument : ${list(client.words_to_avoid)}
Hashtags favoris : ${list(client.hashtags)}
</fiche_marque>

<exemples_apprecies_par_le_client>
${examples}
</exemples_apprecies_par_le_client>

<regles_par_reseau>
${rules}
</regles_par_reseau>

Règles de format :
- "body" contient le texte de la publication SANS les hashtags de fin ; "hashtags" contient les hashtags sans le symbole #.
- La longueur maximale d'un réseau s'applique au texte final : body + saut de ligne + hashtags.
- N'utilise jamais un mot de la liste « Mots à éviter ».
- Réponds uniquement avec un objet JSON conforme au format demandé.`;
}
