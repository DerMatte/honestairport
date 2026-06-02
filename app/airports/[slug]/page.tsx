import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Plane, ShieldCheck, Star } from "lucide-react";
import { AirportDetailTabs } from "@/app/components/airport-detail-tabs";
import { AirportTipBento } from "@/app/components/airport-tip-bento";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  airportJsonLd,
  getAirportBySlug,
  getAirportSlugs,
} from "@/lib/airport-utils";
import { getAirportGuideSummaryByIata } from "@/lib/airport-content";

interface AirportPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAirportSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const airport = getAirportBySlug(slug);

  if (!airport) {
    return {
      title: "Airport not found",
    };
  }

  return {
    title: `${airport.shortName} (${airport.iata}) Airport Guide`,
    description: `${airport.name} guide with Airportist Score, current disruption status, amenities, transport options, reviews, and traveler tips.`,
    openGraph: {
      title: `${airport.shortName} - HonestAirport`,
      description: airport.summary,
      type: "article",
    },
  };
}

export default async function AirportPage({ params }: AirportPageProps) {
  const { slug } = await params;
  const airport = getAirportBySlug(slug);

  if (!airport) {
    notFound();
  }

  const guide = await getAirportGuideSummaryByIata(airport.iata);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,var(--muted),transparent_34%),linear-gradient(180deg,var(--background),var(--background))]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(airportJsonLd(airport)),
        }}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
        </Link>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {airport.iata}
              </Badge>
              <Badge variant="outline" className="font-mono">
                {airport.icao}
              </Badge>
              <DisruptionBadge status={airport.disruption.status} />
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
              {airport.name}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-lg text-muted-foreground">
              <MapPin className="size-5" aria-hidden="true" />
              {airport.city}, {airport.country} · {airport.region}
            </p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              {airport.summary}
            </p>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-xl shadow-foreground/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Airportist Score</div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-mono text-6xl font-semibold tracking-tight">
                      {airport.airportistScore.toFixed(1)}
                    </span>
                    <span className="pb-2 text-muted-foreground">/ 10</span>
                  </div>
                </div>
                <div className="flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
                  <Star className="size-6 fill-current" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Plane className="size-3.5" aria-hidden="true" />
                    Passengers
                  </div>
                  <div className="mt-1 font-mono text-lg">{airport.stats.annualPassengers}</div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Security
                  </div>
                  <div className="mt-1 font-mono text-lg">
                    {airport.stats.averageSecurityMinutes} min
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <AirportTipBento airport={airport} guideTips={guide?.importantTips} />
        </section>

        <section className="mt-10">
          <AirportDetailTabs airport={airport} guide={guide} />
        </section>
      </div>
    </div>
  );
}
