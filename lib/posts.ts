// Statuts et transitions d'une publication (cahier, section 8). Utilisable côté client et serveur.

export const POST_STATUSES = [
  "draft",
  "to_review",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "published_manually",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export function isPostStatus(value: string): value is PostStatus {
  return (POST_STATUSES as readonly string[]).includes(value);
}

// Couleurs par statut (F-24)
export const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "#9ca3af",
  to_review: "#f59e0b",
  scheduled: "#3b82f6",
  publishing: "#8b5cf6",
  published: "#16a34a",
  failed: "#dc2626",
  published_manually: "#0d9488",
};

// Statuts où le contenu reste modifiable
export const EDITABLE_STATUSES: readonly PostStatus[] = ["draft", "to_review", "scheduled", "failed"];

// Transitions manuelles autorisées (le planificateur gère scheduled -> publishing -> published/failed)
export const MANUAL_TRANSITIONS: Record<string, { from: readonly PostStatus[]; to: PostStatus }> = {
  toReview: { from: ["draft"], to: "to_review" },
  schedule: { from: ["draft", "to_review"], to: "scheduled" },
  unschedule: { from: ["scheduled", "to_review"], to: "draft" },
  retry: { from: ["failed"], to: "scheduled" },
  markManual: { from: ["draft", "to_review", "scheduled", "failed"], to: "published_manually" },
};
