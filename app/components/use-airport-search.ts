"use client";

import { useEffect, useState } from "react";
import type { AirportSearchResults } from "@/lib/airport-search";

const EMPTY_RESULTS: AirportSearchResults = {
  airports: [],
  cities: [],
  countries: [],
  examples: null,
};

// Session-level result cache so backspacing through a query or reopening the
// dialog re-renders instantly instead of re-fetching. Mirrors the endpoint's
// s-maxage freshness window.
const CACHE_TTL_MS = 300_000;
const CACHE_MAX_ENTRIES = 100;
const resultCache = new Map<string, { results: AirportSearchResults; fetchedAt: number }>();

function readCache(cacheKey: string): AirportSearchResults | null {
  const entry = resultCache.get(cacheKey);
  if (!entry || Date.now() - entry.fetchedAt >= CACHE_TTL_MS) return null;
  return entry.results;
}

/**
 * Debounced server search for the airport comboboxes. Cached queries render
 * synchronously; otherwise the last settled results stay up while the fetch
 * is in flight (never resetting mid-keystroke, so the list doesn't flicker).
 * `pending` is true only until the very first results exist.
 */
export function useAirportSearch(
  query: string,
  locationFilter: { field: "city" | "country"; value: string } | null,
): { results: AirportSearchResults; pending: boolean } {
  const [settled, setSettled] = useState<AirportSearchResults | null>(null);

  const field = locationFilter?.field ?? null;
  const value = locationFilter?.value ?? null;

  const trimmed = query.trim();
  const params = new URLSearchParams();
  if (trimmed) params.set("q", trimmed);
  if (field && value) params.set(field, value);
  const cacheKey = params.toString();
  const debounceMs = trimmed ? 120 : 0;

  const cached = readCache(cacheKey);

  useEffect(() => {
    if (readCache(cacheKey)) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(
      async () => {
        try {
          const response = await fetch(`/api/airports/search?${cacheKey}`, {
            signal: controller.signal,
          });
          if (response.ok) {
            const next = (await response.json()) as AirportSearchResults;
            resultCache.delete(cacheKey);
            if (resultCache.size >= CACHE_MAX_ENTRIES) {
              const oldest = resultCache.keys().next().value;
              if (oldest !== undefined) resultCache.delete(oldest);
            }
            resultCache.set(cacheKey, { results: next, fetchedAt: Date.now() });
            setSettled(next);
          }
        } catch {
          // Aborted by a newer keystroke, or offline; keep the last results.
        }
      },
      debounceMs,
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cacheKey, debounceMs]);

  return {
    results: cached ?? settled ?? EMPTY_RESULTS,
    pending: cached === null && settled === null,
  };
}
