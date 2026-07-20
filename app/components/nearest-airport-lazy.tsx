"use client";

import dynamic from "next/dynamic";
import {
  NearestAirportLinkSkeleton,
  NearestAirportSidebarSkeleton,
} from "@/app/components/nearest-airport-skeletons";

export const LazyNearestAirportLink = dynamic(
  () =>
    import("./nearest-airport-link").then((mod) => mod.NearestAirportLink),
  {
    ssr: false,
    loading: () => <NearestAirportLinkSkeleton />,
  },
);

export const LazyNearestAirportSidebarItem = dynamic(
  () =>
    import("./nearest-airport-link").then(
      (mod) => mod.NearestAirportSidebarItem,
    ),
  {
    ssr: false,
    loading: () => <NearestAirportSidebarSkeleton />,
  },
);
