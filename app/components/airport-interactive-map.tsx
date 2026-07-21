"use client";

import { useState } from "react";
import Link from "next/link";
import { Map, Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import { ArrowRight } from "lucide-react";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { cn } from "@/lib/utils";
import type { Airport, DisruptionStatus } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

// Free, keyless vector tiles; swap this constant for CARTO/self-hosted if needed.
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

function markerClasses(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "bg-emerald-500";
    case "minor":
      return "bg-yellow-500";
    case "moderate":
      return "bg-orange-500";
    case "severe":
      return "bg-red-500";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

interface AirportInteractiveMapProps {
  airports: Airport[];
}

export default function AirportInteractiveMap({
  airports,
}: AirportInteractiveMapProps) {
  const [selected, setSelected] = useState<Airport | null>(null);
  // The site's dark mode is class-based; the class is set before hydration, so
  // reading it once at mount picks the right basemap.
  const [mapStyle] = useState(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? MAP_STYLES.dark
      : MAP_STYLES.light,
  );

  const mappable = airports.filter(
    (airport) =>
      Number.isFinite(airport.coordinates?.latitude) &&
      Number.isFinite(airport.coordinates?.longitude),
  );

  // If this ever grows to many hundreds of airports, switch the markers to a
  // GeoJSON source with cluster: true instead of individual <Marker>s.
  return (
    <Map
      mapStyle={mapStyle}
      initialViewState={{ longitude: 10, latitude: 30, zoom: 1.3 }}
      cooperativeGestures
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {mappable.map((airport) => (
        <Marker
          key={airport.iata}
          longitude={airport.coordinates.longitude}
          latitude={airport.coordinates.latitude}
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            setSelected((current) =>
              current?.iata === airport.iata ? null : airport,
            );
          }}
        >
          <button
            type="button"
            aria-label={`Show ${airport.name}`}
            className={cn(
              "flex size-4 cursor-pointer items-center justify-center rounded-full text-white shadow-lg ring-2 ring-background transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:hover:scale-110 motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:scale-100",
              markerClasses(airport.disruption.status),
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
          </button>
        </Marker>
      ))}

      {selected ? (
        <Popup
          longitude={selected.coordinates.longitude}
          latitude={selected.coordinates.latitude}
          anchor="bottom"
          offset={12}
          closeButton={false}
          onClose={() => setSelected(null)}
        >
          <div className="text-xs">
            <span className="block font-medium whitespace-nowrap">
              {selected.iata} · {selected.shortName}
            </span>
            <span className="mt-1.5 flex items-center gap-2">
              <DisruptionBadge status={selected.disruption.status} />
              <span className="font-mono">
                {selected.airportistScore.toFixed(1)}
              </span>
            </span>
            <Link
              href={`/airports/${selected.slug}`}
              className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
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
