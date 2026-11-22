"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "text-sm text-muted-foreground hover:text-foreground",
            pathname.startsWith(l.href) && "font-medium text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}
