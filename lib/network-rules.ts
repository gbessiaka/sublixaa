// Règles par réseau (cahier des charges, section 4). Utilisable côté client et serveur.
// À revérifier dans la documentation officielle de chaque plateforme.

export type NetworkId = "facebook" | "instagram" | "linkedin_person" | "linkedin_page" | "x" | "tiktok";

export type NetworkRules = {
  maxLength: number;
  maxHashtags: number | null;
  mediaRequired: boolean;
  allowedImageTypes: string[];
  maxImageBytes: number;
  maxImages: number;
  // false : publication manuelle (TikTok dans le MVP)
  autoPublish: boolean;
  // Couleur d'identification dans l'interface
  color: string;
  // Consigne de style transmise à l'IA
  aiStyle: string;
};

export const NETWORK_RULES: Record<NetworkId, NetworkRules> = {
  instagram: {
    maxLength: 2200,
    maxHashtags: 30,
    mediaRequired: true,
    allowedImageTypes: ["image/jpeg"],
    maxImageBytes: 8 * 1024 * 1024,
    maxImages: 10,
    autoPublish: true,
    color: "#d62976",
    aiStyle:
      "Instagram : accroche forte en première ligne, émojis modérés, phrases courtes, hashtags regroupés à la fin (10 au maximum conseillés, 30 au plus).",
  },
  facebook: {
    maxLength: 63206,
    maxHashtags: null,
    mediaRequired: false,
    allowedImageTypes: ["image/jpeg", "image/png"],
    maxImageBytes: 4 * 1024 * 1024,
    maxImages: 10,
    autoPublish: true,
    color: "#1877f2",
    aiStyle:
      "Facebook (page) : ton conversationnel, viser moins de 500 caractères, terminer par une question ou un appel à l'action, 0 à 3 hashtags.",
  },
  linkedin_person: {
    maxLength: 3000,
    maxHashtags: null,
    mediaRequired: false,
    allowedImageTypes: ["image/jpeg", "image/png"],
    maxImageBytes: 8 * 1024 * 1024,
    maxImages: 9,
    autoPublish: true,
    color: "#0a66c2",
    aiStyle:
      "LinkedIn : ton professionnel, paragraphes courts séparés par des lignes vides, apporter de la valeur concrète, 3 à 5 hashtags à la fin.",
  },
  linkedin_page: {
    maxLength: 3000,
    maxHashtags: null,
    mediaRequired: false,
    allowedImageTypes: ["image/jpeg", "image/png"],
    maxImageBytes: 8 * 1024 * 1024,
    maxImages: 9,
    autoPublish: true,
    color: "#004182",
    aiStyle:
      "LinkedIn (page entreprise) : ton professionnel, paragraphes courts séparés par des lignes vides, apporter de la valeur concrète, 3 à 5 hashtags à la fin.",
  },
  x: {
    maxLength: 280,
    maxHashtags: 2,
    mediaRequired: false,
    allowedImageTypes: ["image/jpeg", "image/png"],
    maxImageBytes: 5 * 1024 * 1024,
    maxImages: 4,
    autoPublish: true,
    color: "#111111",
    aiStyle:
      "X : très court et direct, une seule idée, 1 à 2 hashtags maximum. Le texte complet, hashtags compris, ne doit JAMAIS dépasser 280 caractères (viser 240).",
  },
  tiktok: {
    maxLength: 2200,
    maxHashtags: null,
    mediaRequired: false,
    allowedImageTypes: [],
    maxImageBytes: 0,
    maxImages: 0,
    autoPublish: false,
    color: "#25f4ee",
    aiStyle:
      "TikTok (légende de vidéo) : accroche orale, ton décontracté, courte légende, 3 à 5 hashtags. Ajouter une idée de vidéo dans visual_idea.",
  },
};

export const NETWORK_IDS = Object.keys(NETWORK_RULES) as NetworkId[];

export function isNetworkId(value: string): value is NetworkId {
  return value in NETWORK_RULES;
}

export function getRules(network: string): NetworkRules | null {
  return isNetworkId(network) ? NETWORK_RULES[network] : null;
}

// Normalise un hashtag : sans « # », sans espaces
export function normalizeHashtag(tag: string): string {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

// Texte final envoyé au réseau : corps + hashtags à la fin
export function composeText(body: string, hashtags: readonly string[]): string {
  const tags = hashtags.map(normalizeHashtag).filter(Boolean).map((t) => `#${t}`);
  const trimmed = body.trim();
  if (tags.length === 0) return trimmed;
  // Ne pas répéter les hashtags déjà présents dans le corps
  const missing = tags.filter((t) => !trimmed.toLowerCase().includes(t.toLowerCase()));
  return missing.length ? `${trimmed}\n\n${missing.join(" ")}` : trimmed;
}

// Longueur comptée en caractères visibles (les émojis comptent pour 1).
// Approximation : X compte certains caractères double et les liens pour 23.
export function textLength(text: string): number {
  return Array.from(text).length;
}

export type MediaInfo = { mime_type: string; size_bytes: number };

export type ValidationIssue =
  | { code: "tooLong"; length: number; max: number }
  | { code: "tooManyHashtags"; count: number; max: number }
  | { code: "mediaRequired" }
  | { code: "mediaType"; mime: string }
  | { code: "mediaTooLarge"; maxMb: number }
  | { code: "tooManyMedia"; max: number }
  | { code: "emptyText" }
  | { code: "unknownNetwork" };

// Règle de validation : une publication ne peut pas être programmée si une règle échoue
export function validatePost(
  network: string,
  body: string,
  hashtags: readonly string[],
  media: readonly MediaInfo[],
): ValidationIssue[] {
  const rules = getRules(network);
  if (!rules) return [{ code: "unknownNetwork" }];
  const issues: ValidationIssue[] = [];
  const text = composeText(body, hashtags);
  if (!body.trim()) issues.push({ code: "emptyText" });
  const length = textLength(text);
  if (length > rules.maxLength) issues.push({ code: "tooLong", length, max: rules.maxLength });
  const tagCount = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  if (rules.maxHashtags !== null && tagCount > rules.maxHashtags) {
    issues.push({ code: "tooManyHashtags", count: tagCount, max: rules.maxHashtags });
  }
  if (rules.mediaRequired && media.length === 0) issues.push({ code: "mediaRequired" });
  if (media.length > rules.maxImages && rules.maxImages > 0) {
    issues.push({ code: "tooManyMedia", max: rules.maxImages });
  }
  for (const m of media) {
    if (!rules.allowedImageTypes.includes(m.mime_type)) issues.push({ code: "mediaType", mime: m.mime_type });
    if (rules.maxImageBytes > 0 && m.size_bytes > rules.maxImageBytes) {
      issues.push({ code: "mediaTooLarge", maxMb: Math.round(rules.maxImageBytes / 1024 / 1024) });
    }
  }
  return issues;
}
