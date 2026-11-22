import { TZDate } from "@date-fns/tz";
import { addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";

// Dates stockées en UTC, affichées dans le fuseau du propriétaire (NF-10)

export const DEFAULT_TIMEZONE = "America/Toronto";

// "2026-12-03T09:30" (heure locale du fuseau) -> Date UTC
export function localToUtc(local: string, timeZone: string): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) throw new Error(`Date locale invalide : ${local}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, timeZone).getTime());
}

// Date UTC -> "2026-12-03T09:30" dans le fuseau donné (pour les champs datetime-local)
export function utcToLocalInput(date: Date | string, timeZone: string): string {
  return format(new TZDate(new Date(date), timeZone), "yyyy-MM-dd'T'HH:mm");
}

// Affichage en français dans le fuseau donné
export function formatInTz(date: Date | string, timeZone: string, pattern = "d MMM yyyy 'à' HH:mm"): string {
  return format(new TZDate(new Date(date), timeZone), pattern, { locale: fr });
}

// Mois au format "2026-12" -> premier jour "2026-12-01"
export function monthToDate(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Mois invalide : ${month}`);
  return `${month}-01`;
}

// Mois courant (ou suivant) dans le fuseau du propriétaire, format "2026-12"
export function currentMonth(timeZone: string, offset = 0): string {
  return format(addMonths(new TZDate(new Date(), timeZone), offset), "yyyy-MM");
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: fr });
}

// Bornes UTC d'un mois dans un fuseau
export function monthRangeUtc(month: string, timeZone: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(new TZDate(y, m - 1, 1, 0, 0, 0, timeZone).getTime());
  const end = new Date(new TZDate(y, m, 1, 0, 0, 0, timeZone).getTime());
  return { start, end };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
