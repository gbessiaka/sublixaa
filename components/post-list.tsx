import Link from "next/link";
import { NetworkBadge, StatusBadge } from "@/components/status-badge";
import { formatInTz } from "@/lib/dates";

export type PostListRow = {
  id: string;
  scheduled_at: string | null;
  published_at: string | null;
  network: string;
  body: string;
  topic: string | null;
  status: string;
  error_message?: string | null;
  clients: { name: string } | null;
};

// Liste compacte de publications (tableau de bord, page « À traiter »)
export function PostList({ posts, timeZone, dateField }: { posts: PostListRow[]; timeZone: string; dateField: "scheduled_at" | "published_at" }) {
  return (
    <ul className="flex flex-col divide-y">
      {posts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
          <span className="w-28 shrink-0 text-muted-foreground">{p[dateField] ? formatInTz(p[dateField]!, timeZone, "EEE d MMM HH:mm") : "—"}</span>
          <NetworkBadge network={p.network} />
          <span className="font-medium">{p.clients?.name}</span>
          <Link href={`/content/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">
            {p.topic || p.body}
          </Link>
          <StatusBadge status={p.status} />
          {p.error_message && <span className="basis-full text-xs text-destructive">{p.error_message}</span>}
        </li>
      ))}
    </ul>
  );
}
