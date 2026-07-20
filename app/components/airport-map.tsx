import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { cn } from "@/lib/utils";
import type { Airport } from "@/lib/types";

interface AirportMapProps {
  airports: Airport[];
  variant?: "card" | "hero";
  onExplore?: () => void;
}

function pinPosition(airport: Airport) {
  return {
    left: `${((airport.coordinates.longitude + 180) / 360) * 100}%`,
    top: `${((90 - airport.coordinates.latitude) / 180) * 100}%`,
  };
}

function MapCanvas({
  airports,
  className,
}: {
  airports: Airport[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[16/8.5] overflow-hidden rounded-3xl border border-border/60 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_55%),radial-gradient(circle_at_20%_25%,color-mix(in_oklab,var(--primary)_10%,var(--muted))_0,transparent_26%),radial-gradient(circle_at_52%_34%,var(--muted)_0,transparent_18%),radial-gradient(circle_at_76%_42%,color-mix(in_oklab,var(--chart-2)_8%,var(--muted))_0,transparent_22%),linear-gradient(165deg,color-mix(in_oklab,var(--background)_70%,white),var(--muted))]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "12.5% 33.333%",
        }}
      />
      <div className="absolute inset-x-[8%] top-[18%] h-[24%] rounded-[50%] border border-foreground/10 bg-foreground/[0.035]" />
      <div className="absolute left-[14%] top-[35%] h-[28%] w-[28%] rounded-[55%] border border-foreground/10 bg-foreground/[0.045]" />
      <div className="absolute left-[45%] top-[30%] h-[35%] w-[17%] rounded-[50%] border border-foreground/10 bg-foreground/[0.045]" />
      <div className="absolute right-[9%] top-[28%] h-[33%] w-[28%] rounded-[55%] border border-foreground/10 bg-foreground/[0.045]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/40 to-transparent" />

      {airports.map((airport, index) => (
        <Link
          key={airport.iata}
          href={`/airports/${airport.slug}`}
          className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            ...pinPosition(airport),
            animationDelay: `${Math.min(index, 12) * 40}ms`,
          }}
          aria-label={`Open ${airport.name}`}
        >
          <span className="hero-map-pin relative flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition group-hover:scale-125">
            <span className="size-1.5 rounded-full bg-current" />
          </span>
          <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden -translate-x-1/2 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg group-hover:block">
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
  );
}

export function AirportMap({ airports, variant = "card", onExplore }: AirportMapProps) {
  if (variant === "hero") {
    return (
      <div className="hero-map-enter relative">
        <div
          className={cn(onExplore && "cursor-pointer")}
          onClick={(event) => {
            // Pin links keep navigating to their airport pages.
            if ((event.target as HTMLElement).closest("a")) return;
            onExplore?.();
          }}
        >
          <MapCanvas
            airports={airports}
            className="aspect-[5/4] rounded-[2rem] border-border/50 shadow-[0_30px_80px_-40px_color-mix(in_oklab,var(--primary)_35%,transparent)] sm:aspect-[16/11] lg:aspect-[5/4]"
          />
        </div>
        {onExplore ? (
          <button
            type="button"
            onClick={onExplore}
            className="mx-auto mt-3 block cursor-pointer text-center text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {airports.length > 0
              ? `${airports.length} scored airports · open the interactive map`
              : "Open the interactive map"}
          </button>
        ) : (
          <p className="mt-3 text-center text-xs tracking-wide text-muted-foreground">
            {airports.length > 0
              ? `${airports.length} scored airports · click a pin`
              : "Scored airports appear here as pins"}
          </p>
        )}
      </div>
    );
  }

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
        <MapCanvas airports={airports} />
      </CardContent>
    </Card>
  );
}
