import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AirportGuideSourceLink } from "@/lib/airport-guides";

interface AirportGuideSourcesProps {
  sources: AirportGuideSourceLink[];
  className?: string;
}

export function AirportGuideSources({ sources, className }: AirportGuideSourcesProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <details className={cn("group rounded-xl border border-border/70 bg-muted/20", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-foreground">
          <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
          {sources.length} official {sources.length === 1 ? "source" : "sources"}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="space-y-2 border-t border-border/70 px-4 py-3">
        {sources.map((source) => (
          <li key={source.href}>
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm leading-6 text-primary transition hover:underline"
            >
              <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="break-all">{source.href}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
