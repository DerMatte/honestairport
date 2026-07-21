"use client";

import * as React from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PromptInput({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={1}
      className={cn(
        "max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground",
        className,
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      {...props}
    />
  );
}

export function PromptInputAction({
  streaming,
  ...props
}: React.ComponentProps<typeof Button> & { streaming: boolean }) {
  return (
    <Button type={streaming ? "button" : "submit"} size="icon-lg" {...props}>
      {streaming ? <Square className="size-3.5 fill-current" /> : <Send />}
      <span className="sr-only">{streaming ? "Stop response" : "Send message"}</span>
    </Button>
  );
}
