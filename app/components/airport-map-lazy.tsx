"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Shared lazy entry so the mobile collapsible and the desktop side panel pull
// in the same maplibre chunk, and only once the map is first revealed.
export const LazyAirportMap = dynamic(
  () => import("./airport-interactive-map"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);
