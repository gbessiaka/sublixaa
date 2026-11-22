import "server-only";
import { timingSafeEqual } from "node:crypto";

// NF-05 : les routes du planificateur exigent « Authorization: Bearer <CRON_SECRET> »
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
