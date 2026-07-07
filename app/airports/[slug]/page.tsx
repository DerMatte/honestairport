import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenText, MapPin, Plane, ShieldCheck, Star } from "lucide-react";
import { AirportDetailTabs } from "@/app/components/airport-detail-tabs";
import { AirportGuideArticle } from "@/app/components/airport-guide-article";
import { AirportGuideSources } from "@/app/components/airport-guide-sources";
import { AirportLoungeGrid } from "@/app/components/airport-lounges";
import { AirportReviews } from "@/app/components/airport-reviews";
import {
  AirportLiveStatusPanel,
  AirportLiveStatusProvider,
} from "@/app/components/airport-live-status-loader";
import { AirportTipBento } from "@/app/components/airport-tip-bento";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  airportJsonLd,
  getAirportBySlug,
  getAirportSlugs,
} from "@/lib/airport-utils";
import {
  getAirportContent,
  getAirportGuideSummary,
  getAirportGuideSummaryByIata,
  getAllAirportIatas,
} from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";

interface AirportPageProps {
  params: Promise<{ slug: string }>;
}

// Guides live in Postgres and change without a deploy: prerender known
// airports at build time, serve new ones on demand, and refresh via the
// airport-guides cache tag (plus this timed fallback).
export const revalidate = 300;

export async function generateStaticParams() {
  const guideIatas = await getAllAirportIatas();
  const slugs = new Set([
    ...getAirportSlugs(),
    ...guideIatas.map((iata) => iata.toLowerCase()),
  ]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const airport = getAirportBySlug(slug);

  if (!airport) {
    const guideContent = await getAirportContent(slug);

    if (!guideContent) {
      return {
        title: "Airport not found",
      };
    }

    const { name, iata, city, country } = guideContent.frontmatter;
    const description = `Traveler guide for ${name} in ${city}, ${country}: security tips, terminal navigation, lounges, food, and ground transport.`;
    return {
      title: `${name} (${iata}) Airport Guide`,
      description,
      alternates: {
        canonical: `/airports/${slug}`,
      },
      openGraph: {
        title: `${name} (${iata}) Airport Guide`,
        description,
        type: "article",
        url: `/airports/${slug}`,
      },
      twitter: {
        card: "summary_large_image",
      },
    };
  }

  return {
    title: `${airport.shortName} (${airport.iata}) Airport Guide`,
    description: `${airport.name} guide with Airportist Score, current disruption status, amenities, transport options, reviews, and traveler tips.`,
    alternates: {
      canonical: `/airports/${slug}`,
    },
    openGraph: {
      title: `${airport.shortName} - HonestAirport`,
      description: airport.summary,
      type: "article",
      url: `/airports/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function AirportPage({ params }: AirportPageProps) {
  const { slug } = await params;
  const airport = getAirportBySlug(slug);

  if (!airport) {
    return <GuideOnlyAirportPage slug={slug} />;
  }

  const guide = await getAirportGuideSummaryByIata(airport.iata);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
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
            <h1 className="mt-5 max-w-4xl text-5xl leading-[1.06] tracking-tight text-balance sm:text-6xl">
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

          <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Airportist Score</div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-mono text-6xl font-semibold tracking-tight text-primary">
                      {airport.airportistScore.toFixed(1)}
                    </span>
                    <span className="pb-2 text-muted-foreground">/ 10</span>
                  </div>
                </div>
                <div className="flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
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

async function GuideOnlyAirportPage({ slug }: { slug: string }) {
  const guideContent = await getAirportContent(slug);

  if (!guideContent) {
    notFound();
  }

  const { frontmatter } = guideContent;
  const guide = getAirportGuideSummary(guideContent);
  const record = getAirportByIata(frontmatter.iata);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Airport",
    name: frontmatter.name,
    iataCode: frontmatter.iata,
    ...(record?.icao_code ? { icaoCode: record.icao_code } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: frontmatter.city,
      addressCountry: frontmatter.country,
    },
    ...(record
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: record.latitude,
            longitude: record.longitude,
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
                {frontmatter.iata}
              </Badge>
              {record?.icao_code ? (
                <Badge variant="outline" className="font-mono">
                  {record.icao_code}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-full">
                Editorial guide
              </Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl leading-[1.06] tracking-tight text-balance sm:text-6xl">
              {frontmatter.name}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-lg text-muted-foreground">
              <MapPin className="size-5" aria-hidden="true" />
              {frontmatter.city}, {frontmatter.country}
            </p>
          </div>

          <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Guide quick facts</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Updated {guide.lastUpdated}
                  </div>
                </div>
                <div className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
                  <BookOpenText className="size-6" aria-hidden="true" />
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm leading-6">
                {guide.quickFacts.slice(0, 5).map((fact, index) => (
                  <li key={`${frontmatter.iata}-fact-${index}`} className="flex gap-2">
                    <Plane className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <AirportTipBento guideTips={guide.importantTips} />
        </section>

        <AirportLiveStatusProvider iata={frontmatter.iata}>
          <section aria-labelledby="live-status-heading" className="mt-10 space-y-3">
            <div>
              <p className="text-sm font-medium text-primary">Live airport status</p>
              <h2 id="live-status-heading" className="text-2xl font-semibold tracking-tight">
                Current operations
              </h2>
            </div>
            <AirportLiveStatusPanel className="mb-0" />
          </section>
        </AirportLiveStatusProvider>

        {guide.lounges.length ? (
          <section aria-labelledby="lounges-heading" className="mt-10 space-y-3">
            <div>
              <p className="text-sm font-medium text-primary">Lounges</p>
              <h2 id="lounges-heading" className="text-2xl font-semibold tracking-tight">
                Where to wait in comfort
              </h2>
            </div>
            <AirportLoungeGrid lounges={guide.lounges} />
          </section>
        ) : null}

        <section className="mt-10 max-w-4xl">
          <AirportGuideArticle content={guideContent.content} />
        </section>

        {guide.sourceLinks.length ? (
          <section className="mt-6 max-w-4xl">
            <AirportGuideSources sources={guide.sourceLinks} />
          </section>
        ) : null}

        <AirportReviews iata={frontmatter.iata} showHeading className="mt-10 max-w-4xl" />
      </div>
    </div>
  );
}
