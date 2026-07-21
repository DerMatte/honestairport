"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Map, Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import { ArrowRight } from "lucide-react";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { cn } from "@/lib/utils";
import type { Airport, DisruptionStatus } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

function markerClasses(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "border-emerald-500/80 before:bg-emerald-500";
    case "minor":
      return "border-yellow-500/80 before:bg-yellow-500";
    case "moderate":
      return "border-orange-500/80 before:bg-orange-500";
    case "severe":
      return "border-red-500/80 before:bg-red-500";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export default function AirportInteractiveMap({ airports }: { airports: Airport[] }) {
  const [selectedIata, setSelectedIata] = useState<string | null>(null);
  const [mapStyle] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? MAP_STYLES.dark
      : MAP_STYLES.light,
  );

  const { mappable, airportByIata } = useMemo(() => {
    const nextMappable: Airport[] = [];
    const nextByIata = new globalThis.Map<string, Airport>();

    for (const airport of airports) {
      if (
        Number.isFinite(airport.coordinates?.latitude) &&
        Number.isFinite(airport.coordinates?.longitude)
      ) {
        nextMappable.push(airport);
        nextByIata.set(airport.iata, airport);
      }
    }

    return { mappable: nextMappable, airportByIata: nextByIata };
  }, [airports]);

  const selected = selectedIata ? airportByIata.get(selectedIata) : undefined;

  return (
    <Map
      mapStyle={mapStyle}
      initialViewState={{ longitude: 10, latitude: 30, zoom: 1.3 }}
      cooperativeGestures
      attributionControl={{ compact: true }}
      reuseMaps
      onClick={() => setSelectedIata(null)}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {mappable.map((airport) => (
        <Marker
          key={airport.iata}
          longitude={airport.coordinates.longitude}
          latitude={airport.coordinates.latitude}
          anchor="bottom"
        >
          <button
            type="button"
            aria-label={`${airport.iata}, Airportist Score ${airport.airportistScore.toFixed(1)}. Show details for ${airport.name}`}
            aria-pressed={selectedIata === airport.iata}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedIata((current) => (current === airport.iata ? null : airport.iata));
            }}
            className={cn(
              "relative flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border-2 bg-background/95 px-2 py-1 font-mono text-foreground shadow-lg backdrop-blur-sm transition-[transform,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] before:size-2 before:shrink-0 before:rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] pointer-fine:hover:-translate-y-0.5 pointer-fine:hover:shadow-xl motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:translate-y-0",
              markerClasses(airport.disruption.status),
            )}
          >
            <span className="text-xs font-bold tracking-wide">{airport.iata}</span>
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary">
              {airport.airportistScore.toFixed(1)}
            </span>
          </button>
        </Marker>
      ))}

      {selected ? (
        <Popup
          longitude={selected.coordinates.longitude}
          latitude={selected.coordinates.latitude}
          anchor="bottom"
          offset={42}
          closeButton
          closeOnClick={false}
          onClose={() => setSelectedIata(null)}
        >
          <div className="min-w-40 pr-4 text-xs">
            <span className="block font-medium whitespace-nowrap">
              {selected.iata} · {selected.shortName}
            </span>
            <span className="mt-1.5 flex items-center gap-2">
              <DisruptionBadge status={selected.disruption.status} />
              <span className="font-mono font-semibold">
                Score {selected.airportistScore.toFixed(1)}
              </span>
            </span>
            <span className="mt-2 block text-muted-foreground">
              {selected.stats.averageSecurityMinutes} min avg security · {selected.disruption.departureDelayMinutes} min avg delay
            </span>
            <Link
              href={`/airports/${selected.slug}`}
              className="mt-3 inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              View airport
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </div>
        </Popup>
      ) : null}
    </Map>
  );
}
