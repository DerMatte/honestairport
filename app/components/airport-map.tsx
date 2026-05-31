import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisruptionBadge } from "@/app/components/disruption-status";
import type { Airport } from "@/lib/types";

interface AirportMapProps {
  airports: Airport[];
}

function pinPosition(airport: Airport) {
  return {
    left: `${((airport.coordinates.longitude + 180) / 360) * 100}%`,
    top: `${((90 - airport.coordinates.latitude) / 180) * 100}%`,
  };
}

export function AirportMap({ airports }: AirportMapProps) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/90">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Major Airport Map</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Lightweight static map with clickable MVP airport pins.
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {airports.length} airports
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-[16/8.5] overflow-hidden rounded-3xl border bg-[radial-gradient(circle_at_20%_25%,var(--muted)_0,transparent_26%),radial-gradient(circle_at_52%_34%,var(--muted)_0,transparent_18%),radial-gradient(circle_at_76%_42%,var(--muted)_0,transparent_22%),linear-gradient(135deg,var(--background),var(--muted))]">
          <div className="absolute inset-x-[8%] top-[18%] h-[24%] rounded-[50%] border border-foreground/10 bg-foreground/[0.03]" />
          <div className="absolute left-[14%] top-[35%] h-[28%] w-[28%] rounded-[55%] border border-foreground/10 bg-foreground/[0.04]" />
          <div className="absolute left-[45%] top-[30%] h-[35%] w-[17%] rounded-[50%] border border-foreground/10 bg-foreground/[0.04]" />
          <div className="absolute right-[9%] top-[28%] h-[33%] w-[28%] rounded-[55%] border border-foreground/10 bg-foreground/[0.04]" />
          <div className="absolute left-1/4 top-0 h-full w-px bg-border/50" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-border/50" />
          <div className="absolute left-3/4 top-0 h-full w-px bg-border/50" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-border/50" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-border/50" />

          {airports.map((airport) => (
            <Link
              key={airport.iata}
              href={`/airports/${airport.slug}`}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={pinPosition(airport)}
              aria-label={`Open ${airport.name}`}
            >
              <span className="relative flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition group-hover:scale-125">
                <span className="size-1.5 rounded-full bg-current" />
              </span>
              <span className="pointer-events-none absolute left-1/2 top-5 hidden -translate-x-1/2 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg group-hover:block">
                <span className="block whitespace-nowrap font-medium">
                  {airport.iata} · {airport.shortName}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <DisruptionBadge status={airport.disruption.status} />
                  <span className="font-mono">{airport.airportistScore.toFixed(1)}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
