"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { filterAndSortAirports } from "@/lib/airport-utils";
import { cn } from "@/lib/utils";
import type { Airport, AirportFilters } from "@/lib/types";

interface AirportSearchPanelProps {
  airports: Airport[];
  onSelect?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function searchFilters(query: string): AirportFilters {
  return {
    query,
    minimumScore: 0,
    regions: [],
    amenities: [],
    disruptionStatuses: [],
    sort: "highest-score",
  };
}

export function AirportSearchPanel({
  airports,
  onSelect,
  autoFocus = false,
  className,
}: AirportSearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return airports.slice(0, 6);
    return filterAndSortAirports(airports, searchFilters(query)).slice(0, 8);
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
                {airport.city}, {airport.country} · Score{" "}
                {airport.airportistScore.toFixed(1)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
