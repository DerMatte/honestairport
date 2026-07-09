"use client";

import { createContext, useContext } from "react";
import type { AirportSearchEntry } from "@/lib/airport-search";

const AirportSearchContext = createContext<AirportSearchEntry[]>([]);

/**
 * Shares the site-wide search list (scored + guides + reference airports)
 * from the layout with every search surface, so the ~9k-entry array is
 * serialized into the page exactly once instead of per consumer.
 */
export function AirportSearchProvider({
  airports,
  children,
}: {
  airports: AirportSearchEntry[];
  children: React.ReactNode;
}) {
  return (
    <AirportSearchContext.Provider value={airports}>{children}</AirportSearchContext.Provider>
  );
}

export function useAirportSearchList(): AirportSearchEntry[] {
  return useContext(AirportSearchContext);
}
