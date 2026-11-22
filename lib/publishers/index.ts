import "server-only";
import { linkedinPagePublisher, linkedinPersonPublisher } from "./linkedin";
import { facebookPublisher } from "./meta-facebook";
import { instagramPublisher } from "./meta-instagram";
import type { Publisher } from "./types";
import { xPublisher } from "./x";

export type { Publisher, PublishAccount, PublishInput, PublishResult, OAuthAccount, TokenSet } from "./types";

// Registre des réseaux publiables. Ajouter un réseau = ajouter son fichier et une ligne ici (règle 7).
const PUBLISHERS: Publisher[] = [
  facebookPublisher,
  instagramPublisher,
  linkedinPersonPublisher,
  linkedinPagePublisher,
  xPublisher,
];

export function getPublisher(network: string): Publisher | null {
  return PUBLISHERS.find((p) => p.network === network) ?? null;
}

export function listPublishers(): Publisher[] {
  return PUBLISHERS;
}

export function isPublisherConfigured(publisher: Publisher): boolean {
  return publisher.requiredEnv.every((name) => Boolean(process.env[name]));
}
