import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOwnerContext } from "@/lib/auth/session";
import { currentMonth } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n";
import { PageHeader } from "../page-header";

// Export PDF du calendrier, client par client (F-36)
export default async function ReportsPage() {
  const t = getDictionary();
  const { supabase, settings } = await getOwnerContext();
  const thisMonth = currentMonth(settings.timeZone);
  const nextMonth = currentMonth(settings.timeZone, 1);
  const { data: clients } = await supabase.from("clients").select("id, name").is("archived_at", null).order("name");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.reports.title} subtitle={t.reports.subtitle} />
      {!clients?.length ? (
        <p className="text-muted-foreground">{t.clients.empty}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clients.map((c) => (
            <Card key={c.id} className="gap-4 p-5">
              <p className="font-semibold">{c.name}</p>
              <form action={`/api/export/${c.id}`} method="get" target="_blank" className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`from-${c.id}`}>{t.export.from}</Label>
                  <Input id={`from-${c.id}`} name="from" type="date" required defaultValue={`${thisMonth}-01`} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`to-${c.id}`}>{t.export.to}</Label>
                  <Input id={`to-${c.id}`} name="to" type="date" required defaultValue={`${nextMonth}-01`} />
                </div>
                <Button type="submit">
                  <FileDown />
                  {t.export.download}
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
