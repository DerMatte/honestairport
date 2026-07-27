import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  Clock3,
  DoorOpen,
  ExternalLink,
  KeyRound,
  MapPin,
  ShowerHead,
  Sparkles,
  TriangleAlert,
  Users,
  Utensils,
} from "lucide-react";
import { AirportPageSkeleton } from "@/app/components/loading-skeletons";
import {
  accessMethodLabel,
  AirportLoungeGrid,
  LoungeFactRow,
  LoungeStatusBadge,
  LoungeVerdictBadge,
} from "@/app/components/airport-lounges";
import { SplitFlapText } from "@/app/components/split-flap-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoStrip } from "@/app/components/photo-strip";
import {
  getAirportBySlug,
  getAirportContent,
  getAirportLounge,
  getAirportLoungeImages,
  getAirportLounges,
  getAllAirportLoungeParams,
  type AirportLoungeView,
} from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";
import { formatGuideDate } from "@/lib/utils";

interface LoungePageProps {
  params: Promise<{ slug: string; loungeSlug: string }>;
}

// Cache Components requires at least one param for build-time validation.
const STATIC_PARAMS_PLACEHOLDER = "__placeholder__";

export async function generateStaticParams() {
  const params = await getAllAirportLoungeParams();
  const seed = params[0];
  if (!seed) {
    return [
      { slug: STATIC_PARAMS_PLACEHOLDER, loungeSlug: STATIC_PARAMS_PLACEHOLDER },
    ];
  }
  // One real sample lets Cache Components validate the route without eagerly
  // building every lounge. The remaining lounge pages are cached on first use.
  return [{ slug: seed.iata.toLowerCase(), loungeSlug: seed.slug }];
}

/** Airport display name for titles and breadcrumbs, cheapest source first. */
async function resolveAirportName(slug: string): Promise<string | null> {
  const profile = await getAirportBySlug(slug);
  if (profile) {
    return profile.shortName;
  }

  const guide = await getAirportContent(slug);
  if (guide) {
    return guide.frontmatter.name;
  }

  return getAirportByIata(slug)?.name ?? null;
}

export async function generateMetadata({ params }: LoungePageProps): Promise<Metadata> {
  const { slug, loungeSlug } = await params;
  const iata = slug.trim().toUpperCase();
  const [lounge, airportName] = await Promise.all([
    getAirportLounge(iata, loungeSlug),
    resolveAirportName(slug),
  ]);

  if (!lounge) {
    return { title: "Lounge not found" };
  }

  const displayAirportName = airportName ?? iata;
  const title = `${lounge.name} at ${displayAirportName} (${iata}) – Access, Hours & Review`;
  const canonical = `/airports/${slug}/lounge/${loungeSlug}`;

  return {
    title,
    description: lounge.summary,
    alternates: { canonical },
    openGraph: {
      title,
      description: lounge.summary,
      type: "article",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

function loungeJsonLd(
  lounge: AirportLoungeView,
  iata: string,
  airportName: string,
  imageUrls: string[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: lounge.name,
    description: lounge.summary,
    ...(imageUrls.length ? { image: imageUrls } : {}),
    ...(lounge.hours ? { openingHours: lounge.hours } : {}),
    containedInPlace: {
      "@type": "Airport",
      name: airportName,
      iataCode: iata,
    },
  };
}

function breadcrumbJsonLd(iata: string, airportName: string, slug: string, loungeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Airports", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: `${airportName} (${iata})`,
        item: `/airports/${slug}`,
      },
      { "@type": "ListItem", position: 3, name: loungeName },
    ],
  };
}

export default function LoungePage({ params }: LoungePageProps) {
  return (
    <Suspense fallback={<AirportPageSkeleton />}>
      {params.then(({ slug, loungeSlug }) => (
        <LoungePageContent slug={slug} loungeSlug={loungeSlug} />
      ))}
    </Suspense>
  );
}

async function LoungePageContent({
  slug,
  loungeSlug,
}: {
  slug: string;
  loungeSlug: string;
}) {
  const iata = slug.trim().toUpperCase();

  const [lounge, airportName, images, airportLounges] = await Promise.all([
    getAirportLounge(iata, loungeSlug),
    resolveAirportName(slug),
    getAirportLoungeImages(iata, loungeSlug),
    getAirportLounges(iata),
  ]);

  if (!lounge) {
    notFound();
  }

  const otherLounges = airportLounges.filter(
    (other) => other.slug !== lounge.slug,
  );
  const displayAirportName = airportName ?? iata;
  const descriptionParagraphs = lounge.description
    ? lounge.description.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];

  return (
    <div className="lounge-page min-h-screen">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            loungeJsonLd(lounge, iata, displayAirportName, images.map((image) => image.url)),
          ),
        }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(iata, displayAirportName, slug, lounge.name),
          ),
        }}
      />

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Link
          href={`/airports/${slug}`}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {displayAirportName} ({iata})
        </Link>

        <section className="skeuo-detail-hero mt-6 grid gap-6 p-5 sm:mt-8 sm:p-8 lg:grid-cols-[1fr_340px] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[#9a6415]">
                {iata}
              </Badge>
              <Badge variant="outline" className="rounded-none font-mono">
                {lounge.terminal}
              </Badge>
              {lounge.zone ? (
                <Badge variant="outline" className="rounded-none font-mono">
                  {lounge.zone}
                </Badge>
              ) : null}
              {lounge.verdict ? (
                <LoungeVerdictBadge verdict={lounge.verdict} />
              ) : null}
              <LoungeStatusBadge status={lounge.status} />
            </div>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Lounge field report / {displayAirportName}
            </p>
            <h1 className="mt-2 max-w-4xl text-5xl leading-[0.95] uppercase tracking-[-0.015em] text-balance sm:text-6xl">
              {lounge.name}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {lounge.summary}
            </p>
          </div>

          <Card className="board-shell lounge-briefing-board gap-0 border-board-ink/20 bg-board py-0 text-board-ink shadow-2xl shadow-black/30">
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-board-ink/45">
                    Access briefing
                  </p>
                  <SplitFlapText
                    className="mt-3"
                    length={3}
                    text={iata}
                    tone="amber"
                  />
                </div>
                <div className="lounge-briefing-board__lamp">
                  <span aria-hidden="true" />
                  {lounge.status === "open" ? "Open" : "Check status"}
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-8">
                <div>
                  <span>Terminal</span>
                  <strong>{lounge.terminal}</strong>
                </div>
                <div>
                  <span>Access routes</span>
                  <strong>{lounge.access.length || "Check"}</strong>
                </div>
                <div className="col-span-2">
                  <span>Hours</span>
                  <strong>{lounge.hours ?? "Verify before visiting"}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {images.length ? (
          <div className="mt-8">
            <PhotoStrip images={images} ariaLabel={`${lounge.name} photos`} />
          </div>
        ) : null}

        {lounge.status !== "open" ? (
          <Card className="skeuo-alert-panel mt-8 border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 p-5 text-sm leading-6">
              <TriangleAlert
                className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <p>
                {lounge.status === "temporarily-closed"
                  ? "This lounge is temporarily closed. Check the airport's official site before planning a visit."
                  : "This lounge has closed permanently. The details below are kept for reference."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="skeuo-lounge-card">
              <CardHeader>
                <div className="skeuo-lounge-card__icon [&_svg]:size-5">
                  <KeyRound aria-hidden="true" />
                </div>
                <CardTitle>How to get in</CardTitle>
              </CardHeader>
              <CardContent>
                {lounge.access.length ? (
                  <ul className="space-y-3">
                    {lounge.access.map((method, index) => (
                      <li
                        key={`${method.program}-${index}`}
                        className="lounge-access-row flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm leading-6"
                      >
                        <Badge variant="secondary" className="rounded-full">
                          {accessMethodLabel(method)}
                        </Badge>
                        {method.price ? (
                          <span className="font-mono font-medium">{method.price}</span>
                        ) : null}
                        {method.details ? (
                          <span className="text-muted-foreground">{method.details}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Access rules for this lounge haven&apos;t been verified yet — check the
                    airport&apos;s official site.
                  </p>
                )}
              </CardContent>
            </Card>

            {descriptionParagraphs.length ? (
              <Card className="skeuo-lounge-card">
                <CardHeader>
                  <div className="skeuo-lounge-card__icon [&_svg]:size-5">
                    <DoorOpen aria-hidden="true" />
                  </div>
                  <CardTitle>The honest take</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {descriptionParagraphs.map((paragraph, index) => (
                    <p key={index} className="text-sm leading-7 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className="skeuo-lounge-card">
              <CardHeader>
                <CardTitle>At a glance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lounge.hours ? (
                  <LoungeFactRow icon={<Clock3 aria-hidden="true" />} label="Hours">
                    {lounge.hours}
                  </LoungeFactRow>
                ) : null}
                {lounge.location ? (
                  <LoungeFactRow icon={<MapPin aria-hidden="true" />} label="Finding it">
                    {lounge.location}
                  </LoungeFactRow>
                ) : null}
                {lounge.foodAndDrinks ? (
                  <LoungeFactRow icon={<Utensils aria-hidden="true" />} label="Food & drinks">
                    {lounge.foodAndDrinks}
                  </LoungeFactRow>
                ) : null}
                {lounge.showers !== undefined ? (
                  <LoungeFactRow icon={<ShowerHead aria-hidden="true" />} label="Showers">
                    {lounge.showers ? "Yes" : "No"}
                  </LoungeFactRow>
                ) : null}
                {lounge.amenities.length ? (
                  <LoungeFactRow icon={<Sparkles aria-hidden="true" />} label="Amenities">
                    {lounge.amenities.join(" · ")}
                  </LoungeFactRow>
                ) : null}
                {lounge.bestFor.length ? (
                  <LoungeFactRow icon={<Users aria-hidden="true" />} label="Best for">
                    {lounge.bestFor.join(" · ")}
                  </LoungeFactRow>
                ) : null}
              </CardContent>
            </Card>

            <Card className="skeuo-lounge-card">
              <CardHeader>
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lounge.lastVerified ? (
                  <p className="text-muted-foreground">
                    Last verified {formatGuideDate(lounge.lastVerified)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    From our editorial guide — web verification pending.
                  </p>
                )}
                {lounge.sourceUrls.length ? (
                  <ul className="space-y-2">
                    {lounge.sourceUrls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 break-all text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                          {new URL(url).hostname.replace(/^www\./, "")}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>

        {otherLounges.length ? (
          <section className="mt-12">
            <p className="skeuo-label text-[#9a6415]">Continue exploring</p>
            <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-4xl">
              Other lounges at {displayAirportName}
            </h2>
            <div className="mt-5">
              <AirportLoungeGrid lounges={otherLounges} iata={iata} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
