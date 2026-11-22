import * as React from "react";

import { cn } from "@/lib/utils";

function Badge({ className, color, style, ...props }: React.ComponentProps<"span"> & { color?: string }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        color ? "border-transparent text-white" : "text-foreground",
        className,
      )}
      style={color ? { backgroundColor: color, ...style } : style}
      {...props}
    />
  );
}

export { Badge };
