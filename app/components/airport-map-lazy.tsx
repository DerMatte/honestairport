"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { AirportDirectoryAirport } from "@/lib/types";

const AirportInteractiveMap = dynamic(
  () => import("./airport-interactive-map"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);

export function LazyAirportMap({
  airports,
}: {
  airports: AirportDirectoryAirport[];
}) {
  return <AirportInteractiveMap airports={airports} />;
}
