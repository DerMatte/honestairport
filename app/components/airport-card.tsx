import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Star } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { amenityLabel } from "@/lib/airport-utils";
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
    <Link href={`/airports/${airport.slug}`} className="group block h-full">
      <Card className="h-full border-border/70 bg-card/95 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/5">
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
            <div className="rounded-2xl border bg-background px-3 py-2 text-center shadow-sm">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-current" aria-hidden="true" />
                Score
              </div>
              <div className="font-mono text-2xl font-semibold">
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
              <div className="text-muted-foreground">Passengers</div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {airport.stats.annualPassengers}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="text-muted-foreground">On-time</div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {airport.stats.onTimePercentage}%
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
          <span className="flex items-center gap-1 text-foreground">
            View guide
            <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
