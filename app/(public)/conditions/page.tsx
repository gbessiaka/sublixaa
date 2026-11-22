import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = { title: getDictionary().legal.terms.title };

export default function Page() {
  return <LegalPage content={getDictionary().legal.terms} />;
}
