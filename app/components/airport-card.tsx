import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { amenityLabel, formatGuideFreshness } from "@/lib/airport-utils";
import type { AirportSummary } from "@/lib/airport-content";
import type { AirportDirectoryAirport } from "@/lib/types";

interface AirportCardProps {
  airport: AirportDirectoryAirport;
}

export function AirportCard({ airport }: AirportCardProps) {
  const featuredAmenities = airport.amenities
    .filter((amenity) => amenity.isFeatured)
    .slice(0, 2);
  const amenities =
    featuredAmenities.length > 0 ? featuredAmenities : airport.amenities.slice(0, 2);

  return (
    <Link
      href={`/airports/${airport.slug}`}
      prefetch={false}
      aria-label={`Open the ${airport.name} guide`}
      className="group block h-full focus-visible:outline-none"
    >
      <article className="board-shell overflow-hidden transition-[border-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-board-amber/35 group-focus-visible:ring-2 group-focus-visible:ring-board-amber">
        <div className="hidden grid-cols-[5.25rem_minmax(0,1fr)_5rem_7rem] gap-1 border-b border-white/10 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.17em] text-board-ink/35 sm:grid">
          <span>Code</span>
          <span>Airport / location</span>
          <span>Score</span>
          <span>Condition</span>
        </div>
        <div className="flap-row grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] gap-1 p-2 font-mono sm:grid-cols-[5.25rem_minmax(0,1fr)_5rem_7rem] sm:p-3">
          <span className="flap-field justify-center text-lg font-semibold tracking-[0.08em] text-board-amber">
            {airport.iata}
          </span>
          <span className="flap-field min-w-0 px-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium uppercase tracking-[0.035em] text-board-ink sm:text-base">
                {airport.shortName}
              </span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] uppercase tracking-[0.09em] text-board-ink/45 sm:text-[10px]">
                <MapPin className="size-2.5 shrink-0" aria-hidden="true" />
                {airport.city}, {airport.country}
              </span>
            </span>
          </span>
          <span className="flap-field justify-center text-lg font-semibold text-board-ink">
            {airport.airportistScore.toFixed(1)}
          </span>
          <span className="col-span-3 flex items-center justify-between gap-3 px-2 py-1.5 sm:col-span-1 sm:justify-center sm:px-0 sm:py-0">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-board-ink/40 sm:hidden">
              Current condition
            </span>
            <DisruptionBadge
              status={airport.disruption.status}
              className="rounded-none font-mono text-[9px] uppercase"
            />
          </span>
        </div>

        <div className="grid gap-4 border-t border-white/10 bg-black/10 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {airport.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {amenities.map((amenity) => (
                <Badge
                  key={amenity.id}
                  variant="secondary"
                  className="rounded-none border border-white/8 font-mono text-[9px] uppercase tracking-[0.08em]"
                >
                  {amenityLabel(amenity.category)}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-5 sm:justify-end">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-board-ink/45">
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-3" aria-hidden="true" />
                Security
              </span>
              <span className="mt-1 block text-sm text-board-ink">
                {airport.stats.averageSecurityMinutes} min
              </span>
            </div>
            <span className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-board-amber">
              Open guide
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

interface AirportGuideCardProps {
  airport: AirportSummary;
}

/** A lighter card for guides that don't have Airportist Score data yet. */
export function AirportGuideCard({ airport }: AirportGuideCardProps) {
  return (
    <Link
      href={`/airports/${airport.iata.toLowerCase()}`}
      prefetch={false}
      aria-label={`Open the ${airport.name} guide`}
      className="group block h-full focus-visible:outline-none"
    >
      <article className="board-shell grid min-h-32 gap-1 p-2 transition-[border-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-board-blue/50 group-focus-visible:ring-2 group-focus-visible:ring-board-amber sm:grid-cols-[5.25rem_minmax(0,1fr)_auto] sm:p-3">
        <span className="flap-field justify-center font-mono text-lg font-semibold tracking-[0.08em] text-board-blue">
          {airport.iata}
        </span>
        <span className="flap-field min-w-0 px-3">
          <span className="min-w-0">
            <span className="block truncate font-mono text-sm uppercase tracking-[0.04em] sm:text-base">
              {airport.name}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-board-ink/45">
              <MapPin className="size-3" aria-hidden="true" />
              {airport.city}, {airport.country}
            </span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-4 px-2 py-2 sm:flex-col sm:items-end sm:justify-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-board-ink/45">
            Guide only · {formatGuideFreshness(airport.lastUpdated)}
          </span>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-board-blue">
            Open <ArrowUpRight className="size-4" />
          </span>
        </span>
      </article>
    </Link>
  );
}
