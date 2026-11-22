import Link from "next/link";
import { getDictionary } from "@/lib/i18n";

export function LegalFooter() {
  const t = getDictionary().legal;
  const links = [
    { href: "/confidentialite", label: t.footerPrivacy },
    { href: "/conditions", label: t.footerTerms },
    { href: "/suppression-donnees", label: t.footerDataDeletion },
  ];
  return (
    <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground hover:underline">
          {l.label}
        </Link>
      ))}
    </footer>
  );
}
