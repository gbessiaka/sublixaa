import { getDictionary } from "@/lib/i18n";

// Paramètres publics de l'application (aucun secret ici)
export function getAppConfig() {
  const dict = getDictionary();
  return {
    appName: process.env.APP_NAME || dict.common.defaultAppName,
    legalName: process.env.LEGAL_ENTITY_NAME || dict.common.toComplete,
    contactEmail: process.env.LEGAL_CONTACT_EMAIL || dict.common.toComplete,
    province: process.env.LEGAL_PROVINCE || dict.common.toComplete,
    legalLastUpdated: process.env.LEGAL_LAST_UPDATED || "2026-11-22",
  };
}
