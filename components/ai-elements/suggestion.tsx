"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Suggestion({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-xs leading-5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
