"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AirportSearchEntry } from "@/lib/airport-search";

interface AirportSearchPanelProps {
  airports: AirportSearchEntry[];
  onSelect?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchRank(airport: AirportSearchEntry, query: string): number {
  if (normalize(airport.iata) === query) return 0;
  if (normalize(airport.city).startsWith(query)) return 1;
  if (normalize(airport.name).includes(query)) return 2;
  if (normalize(`${airport.city} ${airport.country}`).includes(query)) return 3;
  return -1;
}

export function AirportSearchPanel({
  airports,
  onSelect,
  autoFocus = false,
  className,
}: AirportSearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return airports.slice(0, 6);

    return airports
      .map((airport) => ({ airport, rank: matchRank(airport, normalizedQuery) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8)
      .map(({ airport }) => airport);
  }, [airports, query]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="p-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by code, name, or city…"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Search airports"
        />
      </div>

      <div className="max-h-72 overflow-y-auto border-t border-border">
        {results.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">No airports found.</div>
        ) : (
          results.map((airport) => (
            <Link
              key={airport.iata}
              href={`/airports/${airport.slug}`}
              onClick={() => {
                setQuery("");
                onSelect?.();
              }}
              className="block px-3 py-2.5 transition hover:bg-muted"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">{airport.iata}</span>
                <span className="text-sm font-medium">{airport.name}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {airport.city}, {airport.country}
                {airport.score !== undefined ? ` · Score ${airport.score.toFixed(1)}` : null}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
