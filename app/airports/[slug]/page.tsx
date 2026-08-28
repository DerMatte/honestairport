import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BookOpenText, MapPin, Plane, ShieldCheck, Star } from "lucide-react";
import { AirportCurrentWeather } from "@/app/components/airport-current-weather";
import { AirportDetailTabsGate } from "@/app/components/airport-detail-tabs-gate";
import { AirportGeneratingView } from "@/app/components/airport-generating-view";
import { AirportPhotoGallery } from "@/app/components/airport-photo-gallery";
import { AirportTipBento } from "@/app/components/airport-tip-bento";
import { NearbyAirports } from "@/app/components/nearby-airports";
import { DisruptionBadge } from "@/app/components/disruption-status";
import {
  AirportPageSkeleton,
  DetailTabsSkeleton,
  GoogleRatingSkeleton,
  PhotoGallerySkeleton,
  TipBentoSkeleton,
} from "@/app/components/loading-skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { airportJsonLd } from "@/lib/airport-utils";
import {
  getAirportBySlug,
  getAirportContent,
  getAirportGoogleRating,
  getAirportGuideSummary,
  getAirportGuideSummaryByIata,
  getAirportLoungesWithFallback,
  getEditorialReviews,
  type AirportGoogleRating,
  type AirportGuideSummary,
  type AirportLoungeView,
} from "@/lib/airport-content";
import { getCachedAirportLiveData } from "@/lib/airport-live-cache";
import type { AirportLiveData } from "@/lib/airport-live-data";
import { getAirportByIata } from "@/lib/airports";
import { MAJOR_AIRPORTS_BY_RANK } from "@/lib/major-airports";
import { formatGuideDate } from "@/lib/utils";
import type { Airport } from "@/lib/types";

interface AirportPageProps {
  params: Promise<{ slug: string }>;
}

// Prerender the busiest airports; every other airport is rendered and cached
// on its first visit.
export function generateStaticParams() {
  return MAJOR_AIRPORTS_BY_RANK.slice(0, 50).map(({ iata }) => ({
    slug: iata.toLowerCase(),
  }));
}

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { slug } = await params;
  // Most slugs are guide-only, so start the guide read alongside the profile
  // lookup instead of waiting for the profile miss. The catch keeps a rejection
  // from going unhandled when the curated path returns without awaiting it.
  const guideContentPromise = getAirportContent(slug);
  guideContentPromise.catch(() => {});
  const airport = await getAirportBySlug(slug);

  if (!airport) {
    const guideContent = await guideContentPromise;

    if (!guideContent) {
      const record = getAirportByIata(slug);
      if (record) {
        const description = `Generating a practical travel guide for ${record.name} in ${record.city_name}.`;
        return {
          title: `${record.name} (${record.iata_code}) Airport Guide`,
          description,
          alternates: {
            canonical: `/airports/${slug}`,
            types: {
              "text/markdown": `/airports/${slug}.md`,
            },
          },
          openGraph: {
            title: `${record.name} (${record.iata_code}) Airport Guide`,
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
        types: {
          "text/markdown": `/airports/${slug}.md`,
        },
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
      types: {
        "text/markdown": `/airports/${slug}.md`,
      },
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

export default function AirportPage({ params }: AirportPageProps) {
  return (
    <Suspense fallback={<AirportPageSkeleton />}>
      {params.then(({ slug }) => (
        <AirportPageContent slug={slug} />
      ))}
    </Suspense>
  );
}

function AirportPageContent({ slug }: { slug: string }) {
  return <AirportPageResolved slug={slug} />;
}

async function AirportPageResolved({ slug }: { slug: string }) {
  // Warm the guide read for guide-only slugs (the majority); React.cache hands
  // this same in-flight promise to GuideOnlyAirportPage. The catch keeps a
  // rejection from going unhandled on the curated path, which never awaits it.
  getAirportContent(slug).catch(() => {});
  const airport = await getAirportBySlug(slug);

  if (!airport) {
    return (
      <Suspense fallback={<AirportPageSkeleton />}>
        <GuideOnlyAirportPage slug={slug} />
      </Suspense>
    );
  }

  return <CuratedAirportPage airport={airport} />;
}

function CuratedAirportPage({ airport }: { airport: Airport }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(airportJsonLd(airport)),
        }}
      />

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <BackToAirportsLink />

        <section className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {airport.iata}
              </Badge>
              {airport.icao ? (
                <Badge variant="outline" className="font-mono">
                  {airport.icao}
                </Badge>
              ) : null}
              <DisruptionBadge status={airport.disruption.status} />
              <Suspense fallback={null}>
                <AirportCurrentWeather iata={airport.iata} />
              </Suspense>
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl leading-[1.1] tracking-tight text-balance sm:mt-5 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.06]">
              {airport.name}
            </h1>
            <p className="mt-3 flex items-start gap-2 text-base text-muted-foreground sm:mt-4 sm:text-lg">
              <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {airport.city}, {airport.country} · {airport.region}
              </span>
            </p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
              {airport.summary}
            </p>
          </div>

          <Card className="border-primary/15 bg-card/95 py-0 shadow-xl shadow-primary/10">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Airportist Score</div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-mono text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
                      {airport.airportistScore.toFixed(1)}
                    </span>
                    <span className="pb-1.5 text-sm text-muted-foreground sm:pb-2 sm:text-base">
                      / 10
                    </span>
                  </div>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 sm:size-14">
                  <Star className="size-5 fill-current sm:size-6" aria-hidden="true" />
                </div>
              </div>

              <Suspense fallback={<GoogleRatingSkeleton />}>
                <GoogleRatingByIata iata={airport.iata} />
              </Suspense>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:mt-6">
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
                    Average security
                  </div>
                  <div className="mt-1 font-mono text-lg">
                    {airport.stats.averageSecurityMinutes} min
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <Suspense fallback={<PhotoGallerySkeleton />}>
            <AirportPhotoGallery iata={airport.iata} />
          </Suspense>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <Suspense fallback={<TipBentoSkeleton />}>
            <CuratedAirportTips airport={airport} />
          </Suspense>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <Suspense fallback={<DetailTabsSkeleton />}>
            <CuratedAirportDetails airport={airport} />
          </Suspense>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <NearbyAirports iata={airport.iata} />
        </section>
      </div>
    </div>
  );
}

async function CuratedAirportTips({ airport }: { airport: Airport }) {
  const guide = await getAirportGuideSummaryByIata(airport.iata);
  return <AirportTipBento airport={airport} guideTips={guide?.importantTips} />;
}

async function CuratedAirportDetails({ airport }: { airport: Airport }) {
  // Guide summary is React.cache-deduped with CuratedAirportTips in the same request.
  const [guide, seedReviews, lounges, initialLiveData] = await Promise.all([
    getAirportGuideSummaryByIata(airport.iata),
    getEditorialReviews(airport.iata),
    getAirportLoungesWithFallback(airport.iata),
    getCachedAirportLiveData(airport.iata),
  ]);
  return (
    <AirportDetailTabsGate
      airport={airport}
      guide={guide}
      seedReviews={seedReviews}
      lounges={lounges}
      initialLiveData={initialLiveData}
    />
  );
}

async function GuideOnlyAirportPage({ slug }: { slug: string }) {
  const iata = slug.trim().toUpperCase();
  // Start lounges and live status alongside content — iata is known from the slug.
  const guideContentPromise = getAirportContent(slug);
  const loungesPromise = getAirportLoungesWithFallback(iata);
  const liveDataPromise = getCachedAirportLiveData(iata);

  const guideContent = await guideContentPromise;

  if (!guideContent) {
    const record = getAirportByIata(slug);
    if (record) {
      return <AirportGeneratingView record={record} />;
    }

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

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <BackToAirportsLink />

        <section className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_360px]">
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
            <h1 className="mt-4 max-w-4xl text-4xl leading-[1.1] tracking-tight text-balance sm:mt-5 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.06]">
              {frontmatter.name}
            </h1>
            <p className="mt-3 flex items-start gap-2 text-base text-muted-foreground sm:mt-4 sm:text-lg">
              <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {frontmatter.city}, {frontmatter.country}
              </span>
            </p>
            <Suspense fallback={null}>
              <AirportCurrentWeather iata={frontmatter.iata} />
            </Suspense>
          </div>

          <Card className="border-primary/15 bg-card/95 py-0 shadow-xl shadow-primary/10">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Guide quick facts</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Updated {formatGuideDate(guide.lastUpdated)}
                  </div>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-3xl bg-primary text-primary-foreground sm:size-14">
                  <BookOpenText className="size-5 sm:size-6" aria-hidden="true" />
                </div>
              </div>

              <Suspense fallback={<GoogleRatingSkeleton />}>
                <GoogleRatingByIata iata={frontmatter.iata} />
              </Suspense>
              <ul className="mt-5 space-y-2 text-sm leading-6">
                {guide.quickFacts.slice(0, 6).map((fact, index) => (
                  <li key={`${frontmatter.iata}-fact-${index}`} className="flex gap-2">
                    <Plane className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <Suspense fallback={<PhotoGallerySkeleton />}>
            <AirportPhotoGallery iata={frontmatter.iata} />
          </Suspense>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <AirportTipBento guideTips={guide.importantTips} />
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <Suspense fallback={<DetailTabsSkeleton />}>
            <GuideOnlyDetailTabs
              iata={frontmatter.iata}
              guide={guide}
              guideMarkdown={guideContent.content}
              loungesPromise={loungesPromise}
              liveDataPromise={liveDataPromise}
            />
          </Suspense>
        </section>

        <section className="mt-8 sm:mt-10 lg:mt-12">
          <NearbyAirports iata={frontmatter.iata} />
        </section>
      </div>
    </div>
  );
}

async function GuideOnlyDetailTabs({
  iata,
  guide,
  guideMarkdown,
  loungesPromise,
  liveDataPromise,
}: {
  iata: string;
  guide: AirportGuideSummary;
  guideMarkdown: string;
  loungesPromise: Promise<AirportLoungeView[]>;
  liveDataPromise: Promise<AirportLiveData | null>;
}) {
  const [lounges, initialLiveData] = await Promise.all([
    loungesPromise,
    liveDataPromise,
  ]);
  return (
    <AirportDetailTabsGate
      iata={iata}
      guide={guide}
      guideMarkdown={guideMarkdown}
      lounges={lounges}
      initialLiveData={initialLiveData}
    />
  );
}

function BackToAirportsLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All airports
    </Link>
  );
}

async function GoogleRatingByIata({ iata }: { iata: string }) {
  const googleRating = await getAirportGoogleRating(iata);
  return <GoogleRatingLine googleRating={googleRating} />;
}

const compactCount = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Crowd-sourced signal next to our editorial score; hidden until synced. */
function GoogleRatingLine({ googleRating }: { googleRating: AirportGoogleRating | null }) {
  if (!googleRating) {
    return null;
  }

  return (
    <p className="mt-4 flex items-center gap-1.5 rounded-2xl border bg-muted/30 px-3 py-2 text-sm">
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-mono">{googleRating.rating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        Google rating · {compactCount.format(googleRating.reviewCount)} reviews
      </span>
    </p>
  );
}
