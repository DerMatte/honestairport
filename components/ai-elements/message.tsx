"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Message({
  from,
  className,
  ...props
}: React.ComponentProps<"div"> & { from: "user" | "assistant" }) {
  return (
    <div
      data-role={from}
      className={cn(
        "flex w-full",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({
  from,
  className,
  ...props
}: React.ComponentProps<"div"> & { from: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
        from === "user"
          ? "rounded-br-md bg-primary text-primary-foreground"
          : "rounded-bl-md border border-border/70 bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MessageResponse({ children }: { children: string }) {
  return (
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: linkChildren }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            {linkChildren}
          </a>
        ),
        p: ({ children: paragraphChildren }) => (
          <p className="mb-2 last:mb-0">{paragraphChildren}</p>
        ),
        ul: ({ children: listChildren }) => (
          <ul className="my-2 list-disc space-y-1 pl-5">{listChildren}</ul>
        ),
        ol: ({ children: listChildren }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5">{listChildren}</ol>
        ),
        strong: ({ children: strongChildren }) => (
          <strong className="font-semibold">{strongChildren}</strong>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
