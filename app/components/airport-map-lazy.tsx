"use client";

import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AirportDirectoryAirport } from "@/lib/types";

// React.lazy does not invoke this import until the component is first rendered.
// Desktop and mobile both wait for an explicit traveler action before mounting.
const AirportInteractiveMap = lazy(() => import("./airport-interactive-map"));

export function LazyAirportMap({
  airports,
}: {
  airports: AirportDirectoryAirport[];
}) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
      <AirportInteractiveMap airports={airports} />
    </Suspense>
  );
}
