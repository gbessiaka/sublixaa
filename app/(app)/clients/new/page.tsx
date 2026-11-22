import { getDictionary } from "@/lib/i18n";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  const t = getDictionary();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.clients.new}</h1>
      <ClientForm t={t} action={createClientAction} />
    </div>
  );
}
