"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Conversation({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
}

export function ConversationContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-4 p-4", className)} {...props} />
  );
}
