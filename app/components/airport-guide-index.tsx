import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { AIRPORT_GUIDES_CACHE_TAG, getAllAirports } from "@/lib/airport-content";

export async function AirportGuideIndex() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 60 * 60 * 24 });
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);

  const airports = await getAllAirports();

  if (airports.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="guide-index-heading" className="mx-auto max-w-7xl px-6 pb-16">
      <div className="mb-6">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Editorial guides
        </p>
        <h2 id="guide-index-heading" className="mt-1 text-3xl tracking-tight">
          All airport guides
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Practical one-page guides for {airports.length} major airports: security
          tactics, terminal navigation, lounges, food, and ground transport.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {airports.map((airport) => (
          <li key={airport.iata}>
            <Link
              href={`/airports/${airport.iata.toLowerCase()}`}
              className="group flex h-full items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {airport.iata}
                  </Badge>
                </div>
                <div className="mt-2 text-sm font-medium leading-5">{airport.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {airport.city}, {airport.country}
                </div>
              </div>
              <ArrowUpRight
                className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
