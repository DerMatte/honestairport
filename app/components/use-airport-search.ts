"use client";

import { useEffect, useState } from "react";
import type { AirportSearchResults } from "@/lib/airport-search";

const EMPTY_RESULTS: AirportSearchResults = {
  airports: [],
  cities: [],
  countries: [],
  examples: null,
};

/**
 * Debounced server search for the airport comboboxes. Returns the last
 * settled results (never resetting mid-keystroke, so the list doesn't
 * flicker) plus whether the very first response is still pending.
 */
export function useAirportSearch(
  query: string,
  locationFilter: { field: "city" | "country"; value: string } | null,
): { results: AirportSearchResults; pending: boolean } {
  const [results, setResults] = useState<AirportSearchResults | null>(null);

  const field = locationFilter?.field ?? null;
  const value = locationFilter?.value ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    if (field && value) params.set(field, value);

    const timeout = window.setTimeout(
      async () => {
        try {
          const response = await fetch(`/api/airports/search?${params.toString()}`, {
            signal: controller.signal,
          });
          if (response.ok) {
            setResults((await response.json()) as AirportSearchResults);
          }
        } catch {
          // Aborted by a newer keystroke, or offline; keep the last results.
        }
      },
      trimmed ? 120 : 0,
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, field, value]);

  return { results: results ?? EMPTY_RESULTS, pending: results === null };
}
