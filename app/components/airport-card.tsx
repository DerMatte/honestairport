import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Star } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { amenityLabel, formatGuideFreshness } from "@/lib/airport-utils";
import type { AirportSummary } from "@/lib/airport-content";
import type { Airport } from "@/lib/types";

interface AirportCardProps {
  airport: Airport;
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
      className="group block h-full transition-[translate,scale] duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:hover:-translate-y-px motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:translate-none"
    >
      <Card className="h-full border-border/70 bg-card/95 shadow-sm transition-[border-color] duration-[var(--duration-press)] ease-[var(--ease-out)] pointer-fine:group-hover:border-primary/30">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {airport.iata}
                </Badge>
                <DisruptionBadge status={airport.disruption.status} />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                {airport.shortName}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {airport.city}, {airport.country}
              </p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-center shadow-sm">
              <div className="flex items-center justify-center gap-1 text-xs text-primary">
                <Star className="size-3 fill-current" aria-hidden="true" />
                Score
              </div>
              <div className="font-mono text-2xl font-semibold text-primary">
                {airport.airportistScore.toFixed(1)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {airport.summary}
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="text-muted-foreground">Avg delay</div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {airport.disruption.departureDelayMinutes} min
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="text-muted-foreground">Cancellations</div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {airport.disruption.cancellationsPercent}%
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <Badge key={amenity.id} variant="secondary" className="rounded-full">
                {amenityLabel(amenity.category)}
              </Badge>
            ))}
          </div>
        </CardContent>

        <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {airport.stats.averageSecurityMinutes} min avg security
          </span>
          <span className="flex items-center gap-1 font-medium text-primary">
            View guide
            <ArrowUpRight className="size-3.5" />
          </span>
        </CardFooter>
      </Card>
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
      className="group block h-full transition-[translate,scale] duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:hover:-translate-y-px motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:translate-none"
    >
      <Card className="h-full border-dashed border-border/70 bg-card/60 shadow-sm transition-[border-color,background-color] duration-[var(--duration-press)] ease-[var(--ease-out)] pointer-fine:group-hover:border-primary/30 pointer-fine:group-hover:bg-card/95">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="font-mono">
              {airport.iata}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatGuideFreshness(airport.lastUpdated)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{airport.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {airport.city}, {airport.country}
            </p>
          </div>
        </CardHeader>

        <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
          <span>No Airportist Score yet</span>
          <span className="flex items-center gap-1 font-medium text-primary">
            View guide
            <ArrowUpRight className="size-3.5" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
