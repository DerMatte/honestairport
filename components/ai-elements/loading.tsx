import { cn } from "@/lib/utils";

export function Loading({ className, label = "Checking HonestAirport guides" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)} role="status">
      <span className="flex gap-1" aria-hidden="true">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
      </span>
      {label}…
    </div>
  );
}
