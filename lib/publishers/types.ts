import type { NetworkId } from "@/lib/network-rules";

// Jetons obtenus ou renouvelés auprès d'une plateforme (en clair : à chiffrer avant stockage)
export type TokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
};

// Compte trouvé après une autorisation OAuth (page Facebook, profil LinkedIn, etc.)
export type OAuthAccount = TokenSet & {
  externalId: string;
  displayName: string;
  metadata?: Record<string, unknown>;
};

// Compte connecté, jetons déchiffrés, transmis à l'adaptateur au moment de publier
export type PublishAccount = {
  externalId: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  metadata: Record<string, unknown>;
};

export type PublishMedia = {
  // URL signée temporaire, lisible par la plateforme (Instagram, Facebook)
  url: string;
  mimeType: string;
  sizeBytes: number;
  // Contenu binaire (LinkedIn, X envoient le fichier eux-mêmes)
  bytes: () => Promise<ArrayBuffer>;
};

export type PublishInput = {
  text: string;
  media: PublishMedia[];
  account: PublishAccount;
};

// Résumé de l'échange, conservé dans publish_logs (NF-08) — jamais de jeton
export type PublishTrace = { request: Record<string, unknown>; status?: number; body?: string };

export type PublishResult =
  | { ok: true; url: string; externalId: string; trace: PublishTrace }
  | { ok: false; error: string; trace: PublishTrace };

export type Publisher = {
  network: NetworkId;
  // Nom des variables d'environnement nécessaires (pour afficher « non configuré »)
  requiredEnv: string[];
  oauth: {
    usesPkce: boolean;
    authorizeUrl(params: { state: string; redirectUri: string; codeChallenge?: string }): string;
    // Échange le code contre un ou plusieurs comptes publiables
    exchange(params: { code: string; redirectUri: string; codeVerifier?: string }): Promise<OAuthAccount[]>;
  };
  // true si le jeton peut être renouvelé automatiquement (F-11)
  canRefresh(account: PublishAccount): boolean;
  refresh?(account: PublishAccount): Promise<TokenSet>;
  // Interface commune : publish(post) → { url, externalId } | { error }
  publish(input: PublishInput): Promise<PublishResult>;
};
