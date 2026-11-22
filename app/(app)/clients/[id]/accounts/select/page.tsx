import { Button } from "@/components/ui/button";
import { getOwnerContext } from "@/lib/auth/session";
import { getDictionary, interpolate } from "@/lib/i18n";
import { selectCandidatesAction } from "../../accounts-actions";

export default async function SelectAccountsPage({ params }: PageProps<"/clients/[id]/accounts/select">) {
  const t = getDictionary();
  const { id } = await params;
  const { supabase } = await getOwnerContext();
  const [{ data: client }, { data: candidates }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase.from("oauth_candidates").select("id, network, display_name, external_id").eq("client_id", id).order("display_name"),
  ]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.accounts.selectTitle}</h1>
        <p className="text-muted-foreground">{interpolate(t.accounts.selectDescription, { client: client?.name ?? "" })}</p>
      </div>
      {!candidates?.length ? (
        <p className="text-muted-foreground">{t.accounts.selectEmpty}</p>
      ) : (
        <form action={selectCandidatesAction.bind(null, id)} className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 rounded-md border p-3">
                  <input type="checkbox" name="candidate" value={c.id} className="size-4" />
                  <span className="font-medium">{c.display_name}</span>
                  <span className="text-xs text-muted-foreground">{(t.networks as Record<string, string>)[c.network]}</span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <Button type="submit">{t.accounts.selectSubmit}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
