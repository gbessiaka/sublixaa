import { getAppConfig } from "@/lib/config";
import { getDictionary, interpolate } from "@/lib/i18n";

type LegalContent = {
  title: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
};

// Affiche une page légale à partir de son contenu dans lib/i18n
export function LegalPage({ content }: { content: LegalContent }) {
  const dict = getDictionary();
  const config = getAppConfig();
  const vars = {
    appName: config.appName,
    legalName: config.legalName,
    contactEmail: config.contactEmail,
    province: config.province,
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{config.appName}</p>
        <h1 className="text-3xl font-semibold">{content.title}</h1>
        <p className="text-sm text-muted-foreground">
          {interpolate(dict.legal.lastUpdated, { date: config.legalLastUpdated })}
        </p>
      </header>
      {content.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p} className="leading-relaxed">
              {interpolate(p, vars)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
