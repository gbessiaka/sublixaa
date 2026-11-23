import "server-only";
import { getRules } from "@/lib/network-rules";
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

// Publication automatique seulement si le réseau le permet ET que ses identifiants sont configurés.
// Sinon, la publication se fait à la main (copier le texte, puis « Marquer publié manuellement »).
export function publishesAutomatically(network: string): boolean {
  const publisher = getPublisher(network);
  return Boolean(getRules(network)?.autoPublish && publisher && isPublisherConfigured(publisher));
}
