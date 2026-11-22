import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/lib/i18n";
import { getRules } from "@/lib/network-rules";
import { STATUS_COLORS, isPostStatus } from "@/lib/posts";

export function StatusBadge({ status }: { status: string }) {
  const t = getDictionary().statuses;
  if (!isPostStatus(status)) return <Badge>{status}</Badge>;
  return <Badge color={STATUS_COLORS[status]}>{t[status]}</Badge>;
}

export function NetworkBadge({ network }: { network: string }) {
  const t = getDictionary().networks;
  const label = (t as Record<string, string>)[network] ?? network;
  return <Badge color={getRules(network)?.color}>{label}</Badge>;
}
