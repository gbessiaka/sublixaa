import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import type { ValidationIssue } from "@/lib/network-rules";

// Message lisible pour un problème de validation (F-21)
export function issueMessage(t: Dictionary["post"]["issues"], issue: ValidationIssue): string {
  const vars = Object.fromEntries(Object.entries(issue).map(([k, v]) => [k, String(v)]));
  return interpolate(t[issue.code], vars);
}

// Découpe une liste saisie "a, b, c" en tableau propre
export function splitList(value: FormDataEntryValue | null, separator: RegExp = /[,\n]/): string[] {
  return String(value ?? "")
    .split(separator)
    .map((v) => v.trim())
    .filter(Boolean);
}
