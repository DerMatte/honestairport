import Link from "next/link";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JoinCheckoutLink } from "@/app/components/join-checkout-link";
import { checkoutUrlForPath } from "@/lib/whop-access";
import type { AirportTeaser } from "@/lib/whop-teaser";

export function MembershipTeaser({
  teaser,
  returnPath,
  scope = "airport",
  variant = "page",
  title,
  heading,
  backHref,
  backLabel,
}: {
  teaser: AirportTeaser;
  returnPath: string;
  scope?: "airport" | "lounge";
  variant?: "page" | "panel";
  /** Visible H1 — lounge name or tab name. Defaults to the airport name. */
  title?: string;
  heading?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const checkoutHref = checkoutUrlForPath(returnPath);
  const place = [teaser.city, teaser.country].filter(Boolean).join(", ");
  const pageHeading = heading ?? title ?? teaser.name;
  const airportHref = `/airports/${teaser.iata.toLowerCase()}`;
  const resolvedBackHref =
    backHref ??
    (scope === "lounge" ? `${airportHref}?tab=lounges` : airportHref);
  const resolvedBackLabel =
    backLabel ??
    (scope === "lounge" ? "Back to lounges" : `Back to ${teaser.iata}`);
  const fallbackBlurb =
    scope === "lounge"
      ? "Full lounge pages — access rules, hours, and photos — are for HonestAirport members. The airport overview, Getting There, and lounge directory stay free."
      : "Amenities, tips, water, disruptions, and reviews are for HonestAirport members. Overview, Getting There, and the lounge directory stay free.";
  const joinCopy =
    scope === "lounge"
      ? "$8/month unlocks every lounge page and the extra airport tabs. Cancel anytime — access ends when the membership ends."
      : "$8/month unlocks the extra airport tabs and every lounge page. Cancel anytime — access ends when the membership ends.";
  const panelTitle = heading
    ? `Unlock ${heading}`
    : "Join HonestAirport Members";
  const panelCopy = heading
    ? `${heading} is for HonestAirport members. ${joinCopy}`
    : joinCopy;

  const cta = (
    <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {variant === "panel" ? panelTitle : "Join HonestAirport Members"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {variant === "panel" ? panelCopy : joinCopy}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="sm:flex-1" asChild>
            <JoinCheckoutLink href={checkoutHref}>
              Subscribe — $8/month
            </JoinCheckoutLink>
          </Button>
          <Button size="lg" variant="outline" className="sm:flex-1" asChild>
            <Link href={`/members?next=${encodeURIComponent(returnPath)}#restore`}>
              Already a member?
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (variant === "panel") {
    return cta;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-6 sm:py-10">
        <Link
          href={resolvedBackHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {resolvedBackLabel}
        </Link>

        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {teaser.iata}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Members
            </Badge>
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
            {pageHeading}
          </h1>
          {heading || title ? (
            <p className="mt-3 flex items-start gap-2 text-base text-muted-foreground sm:text-lg">
              <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {teaser.name}
                {place ? ` · ${place}` : ""}
              </span>
            </p>
          ) : place ? (
            <p className="mt-3 flex items-start gap-2 text-base text-muted-foreground sm:text-lg">
              <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>{place}</span>
            </p>
          ) : null}
          {teaser.blurb ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {teaser.blurb}
            </p>
          ) : (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {fallbackBlurb}
            </p>
          )}
        </section>

        <div className="mt-8">{cta}</div>
      </div>
    </div>
  );
}
