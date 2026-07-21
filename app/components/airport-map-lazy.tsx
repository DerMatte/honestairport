"use client";

import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Airport } from "@/lib/types";

// React.lazy does not invoke this import until the component is first rendered.
// Desktop renders it after the lg media query hydrates; mobile only renders it
// after the traveler explicitly switches to Map.
const AirportInteractiveMap = lazy(() => import("./airport-interactive-map"));

export function LazyAirportMap({ airports }: { airports: Airport[] }) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
      <AirportInteractiveMap airports={airports} />
    </Suspense>
  );
}
