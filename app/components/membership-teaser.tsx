import Link from "next/link";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkoutUrlForPath } from "@/lib/whop-access";
import type { AirportTeaser } from "@/lib/whop-teaser";

export function MembershipTeaser({
  teaser,
  returnPath,
}: {
  teaser: AirportTeaser;
  returnPath: string;
}) {
  const checkoutHref = checkoutUrlForPath(returnPath);
  const place = [teaser.city, teaser.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
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
            {teaser.name}
          </h1>
          {place ? (
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
              Full traveler intel for this airport — scores, the guide, lounges,
              and reviews — is for HonestAirport members.
            </p>
          )}
        </section>

        <Card className="mt-8 border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
          <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lock className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Join HonestAirport Members
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  $8/month unlocks every airport and lounge page. Cancel anytime
                  — access ends when the membership ends.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" className="sm:flex-1" asChild>
                <a href={checkoutHref} rel="noopener noreferrer">
                  Subscribe — $8/month
                </a>
              </Button>
              <Button size="lg" variant="outline" className="sm:flex-1" asChild>
                <Link href={`/members?next=${encodeURIComponent(returnPath)}`}>
                  Already a member?
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
