"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

// Filtre par réseau : met à jour ?network= dans l'URL
export function NetworkFilter({ value, allLabel, options }: { value: string; allLabel: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <NativeSelect
      aria-label={allLabel}
      className="h-10 w-auto min-w-44 bg-card"
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams);
        if (e.target.value) params.set("network", e.target.value);
        else params.delete("network");
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
