import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  accessMethodLabel,
  AirportLoungeGrid,
  LoungeFactRow,
  LoungeStatusBadge,
  LoungeVerdictBadge,
} from "@/app/components/airport-lounges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAirportBySlug,
  getAirportContent,
  getAirportLounge,
  getAirportLounges,
  getAllAirportLoungeParams,
  type AirportLoungeView,
} from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";
import { formatGuideDate } from "@/lib/utils";

interface LoungePageProps {
  params: Promise<{ slug: string; loungeSlug: string }>;
}

export async function generateStaticParams() {
  const params = await getAllAirportLoungeParams();
  return params.map(({ iata, slug }) => ({
    slug: iata.toLowerCase(),
    loungeSlug: slug,
  }));
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
  const lounge = await getAirportLounge(iata, loungeSlug);

  if (!lounge) {
    return { title: "Lounge not found" };
  }

  const airportName = (await resolveAirportName(slug)) ?? iata;
  const title = `${lounge.name} at ${airportName} (${iata}) – Access, Hours & Review`;
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

function loungeJsonLd(lounge: AirportLoungeView, iata: string, airportName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: lounge.name,
    description: lounge.summary,
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

export default async function LoungePage({ params }: LoungePageProps) {
  const { slug, loungeSlug } = await params;
  const iata = slug.trim().toUpperCase();

  const [lounge, airportName] = await Promise.all([
    getAirportLounge(iata, loungeSlug),
    resolveAirportName(slug),
  ]);

  if (!lounge) {
    notFound();
  }

  const otherLounges = (await getAirportLounges(iata)).filter(
    (other) => other.slug !== lounge.slug,
  );
  const displayAirportName = airportName ?? iata;
  const descriptionParagraphs = lounge.description
    ? lounge.description.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(loungeJsonLd(lounge, iata, displayAirportName)),
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

      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href={`/airports/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {displayAirportName} ({iata})
        </Link>

        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {iata}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {lounge.terminal}
            </Badge>
            {lounge.zone ? (
              <Badge variant="outline" className="rounded-full">
                {lounge.zone}
              </Badge>
            ) : null}
            {lounge.verdict ? <LoungeVerdictBadge verdict={lounge.verdict} /> : null}
            <LoungeStatusBadge status={lounge.status} />
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">
            {lounge.name}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            {lounge.summary}
          </p>
        </section>

        {lounge.status !== "open" ? (
          <Card className="mt-8 border-red-500/30 bg-red-500/5">
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
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
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
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border bg-muted/30 p-3 text-sm leading-6"
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
              <Card>
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
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
            <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
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

            <Card>
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
            <h2 className="text-2xl font-semibold tracking-tight">
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
