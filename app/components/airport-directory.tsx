"use client";

import { useMemo, useState } from "react";
import type { AirportSummary } from "@/lib/airport-content";
import { filterAirports } from "@/lib/filter-airports";

interface AirportDirectoryProps {
  airports: AirportSummary[];
}

export function AirportDirectory({ airports }: AirportDirectoryProps) {
  const [query, setQuery] = useState("");

  const filteredAirports = useMemo(
    () => filterAirports(airports, query),
    [airports, query],
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tighter">Airports</h1>
        <p className="mt-3 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          The most important practical information for major airports — security, clever tricks, navigation, lounges, and more.
          One clean, scannable page per airport.
        </p>
      </div>

      <label className="mb-8 block">
        <span className="sr-only">Search airports</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by code, name, or city…"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
        />
      </label>

      {filteredAirports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {airports.length === 0
            ? "No airport pages yet. Add a Markdown file under content/airports/ to get started."
            : "No airports match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAirports.map((airport) => (
            <a
              key={airport.iata}
              href={`/airports/${airport.iata.toLowerCase()}`}
              className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="font-mono text-xs tracking-[3px] text-zinc-500">{airport.iata}</div>
              <div className="mt-2 text-xl font-semibold tracking-tight group-hover:underline">{airport.name}</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {airport.city}, {airport.country}
              </div>
              <div className="mt-4 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                View best tips &amp; tricks →
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-12 text-xs text-zinc-500">
        {airports.length} airport{airports.length === 1 ? "" : "s"} published. All content prioritizes official sources + verified traveler tricks.
      </div>
    </div>
  );
}
