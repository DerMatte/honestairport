import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getNearbyAirports } from "@/lib/airports";

interface NearbyAirportsProps {
  iata: string;
}

function formatDistance(km: number): string {
  return `${Math.round(km)} km`;
}

export function NearbyAirports({ iata }: NearbyAirportsProps) {
  const nearby = getNearbyAirports(iata);

  if (nearby.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="nearby-airports-heading">
      <h2
        id="nearby-airports-heading"
        className="text-2xl font-semibold tracking-tight"
      >
        Nearby airports
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Other airports within about 150 km.
      </p>

      <ul className="mt-6 divide-y divide-border/70 rounded-2xl border border-border/70 bg-card/50">
        {nearby.map((airport) => (
          <li key={airport.iata}>
            <Link
              href={`/airports/${airport.slug}`}
              className="group flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-muted/40 sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {airport.iata}
                  </Badge>
                  <span className="truncate font-medium">{airport.name}</span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {airport.city}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {formatDistance(airport.distanceKm)}
                </span>
                <ArrowUpRight
                  className="size-4 transition group-hover:text-foreground"
                  aria-hidden="true"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
