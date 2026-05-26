"use client";

import { useMemo, useState } from "react";
import type { AirportSummary } from "@/lib/airport-content";
import { filterAirports } from "@/lib/filter-airports";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AirportSearchPanelProps {
  airports: AirportSummary[];
  onSelect?: () => void;
  autoFocus?: boolean;
  className?: string;
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
    return filterAirports(airports, query).slice(0, 8);
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
            <a
              key={airport.iata}
              href={`/airports/${airport.iata.toLowerCase()}`}
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
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
