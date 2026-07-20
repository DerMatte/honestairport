import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Kept in their own module (only depends on Skeleton + cn) so the
// next/dynamic `loading` fallback in nearest-airport-lazy.tsx never has to
// statically import the heavy nearest-airport-link module it is meant to
// code-split away.
export function NearestAirportLinkSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn("mr-2 h-4 w-[7.5rem]", className)}
    />
  );
}

export function NearestAirportSidebarSkeleton() {
  return (
    <div className="flex items-start gap-2 px-2 py-2.5">
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-1.5 pt-0.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
