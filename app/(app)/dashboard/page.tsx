import { getDictionary } from "@/lib/i18n";

export default function DashboardPage() {
  const t = getDictionary().dashboard;
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-muted-foreground">{t.empty}</p>
    </div>
  );
}
