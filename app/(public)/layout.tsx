import { LegalFooter } from "@/components/legal-footer";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-4 py-12">
      <main className="flex-1">{children}</main>
      <LegalFooter />
    </div>
  );
}
