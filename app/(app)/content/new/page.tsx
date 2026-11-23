import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOwnerContext } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { NETWORK_IDS, NETWORK_RULES } from "@/lib/network-rules";
import { publishesAutomatically } from "@/lib/publishers";
import { PageHeader } from "../../page-header";
import { Composer } from "./composer";

// F-15, F-18, F-20 : créer une publication, écrite à la main ou à partir d'une proposition
export default async function NewPostPage({ searchParams }: PageProps<"/content/new">) {
  const t = getDictionary();
  const sp = await searchParams;
  const { supabase, user, settings } = await getOwnerContext();
  const { data: clients } = await supabase.from("clients").select("id, name").is("archived_at", null).order("name");
  const labels = t.networks as Record<string, string>;
  const requested = typeof sp.client === "string" ? sp.client : "";
  const defaultClientId = clients?.some((c) => c.id === requested) ? requested : (clients?.[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.compose.title} subtitle={t.compose.subtitle}>
        <Button asChild variant="outline" className="h-10 px-5">
          <Link href="/content">{t.compose.allPosts}</Link>
        </Button>
      </PageHeader>
      {!clients?.length ? (
        <p className="text-muted-foreground">{t.clients.empty}</p>
      ) : (
        <Composer
          t={t}
          ownerId={user.id}
          clients={clients}
          defaultClientId={defaultClientId}
          timeZone={settings.timeZone}
          networks={NETWORK_IDS.map((id) => ({
            id,
            label: labels[id] ?? id,
            maxLength: NETWORK_RULES[id].maxLength,
            mediaRequired: NETWORK_RULES[id].mediaRequired,
            auto: publishesAutomatically(id),
          }))}
        />
      )}
    </div>
  );
}
