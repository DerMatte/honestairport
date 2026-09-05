import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Lock,
  MapPin,
  Star,
} from "lucide-react";
import { MembershipTeaser } from "@/app/components/membership-teaser";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  SCORE_BREAKDOWN_ROWS,
  compareScoreWinner,
  compareSideIdentity,
  formatLoungeHighlight,
  type CompareSideView,
} from "@/lib/compare-airports";
import { compareSearchHref } from "@/lib/compare-search-params";
import { cn } from "@/lib/utils";
import type { HtmlAccess } from "@/lib/whop-gate";
import type { AirportTeaser } from "@/lib/whop-teaser";

function sideError(side: CompareSideView): string | null {
  switch (side.status) {
    case "invalid":
      return `${side.raw} isn’t a valid IATA code. Use a 3-letter airport code like LGA or SIN.`;
    case "unknown":
      return `We don’t recognize ${side.iata} as an airport code.`;
    default:
      return null;
  }
}

function ScoreCell({
  value,
  winner,
}: {
  value: number | undefined;
  winner: boolean;
}) {
  if (value == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span
          className={cn(
            "font-mono",
            winner ? "font-semibold text-primary" : "text-foreground",
          )}
        >
          {value.toFixed(1)}
        </span>
      </div>
      <Progress value={value * 10} />
    </div>
  );
}

function PhraseList({
  items,
  variant,
}: {
  items: string[];
  variant: "secondary" | "outline";
}) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant={variant} className="rounded-full">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function AirportHeader({ side }: { side: CompareSideView }) {
  if (side.status === "scored" || side.status === "unscored") {
    const { identity } = side;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {identity.iata}
          </Badge>
          {side.status === "scored" ? (
            <DisruptionBadge status={side.scores.disruptionStatus} />
          ) : (
            <Badge variant="secondary" className="rounded-full">
              {side.hasGuide ? "Guide only" : "No guide yet"}
            </Badge>
          )}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {identity.name}
        </h2>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {identity.city}, {identity.country}
          </span>
        </p>
      </div>
    );
  }

  const error = sideError(side);
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm leading-6 text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">Pick an airport to start.</p>
    </div>
  );
}

function ReadyPrompt({
  bothReady,
  oneReady,
}: {
  bothReady: boolean;
  oneReady: boolean;
}) {
  if (bothReady) return null;

  return (
    <Card className="border-primary/10 bg-card/90">
      <CardContent className="p-5 sm:p-6">
        <p className="font-heading text-lg font-medium tracking-tight">
          {oneReady
            ? "Pick a second airport to compare scores."
            : "Pick two airports to compare scores side by side."}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Airportist Scores, breakdowns, and lounge highlights stay free.
          Deeper tips and lounge pages stay on each airport page.
        </p>
      </CardContent>
    </Card>
  );
}

function AirportLinks({
  slug,
  iata,
}: {
  slug: string;
  iata: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/airports/${slug}`}>
          {iata} Overview
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href={`/airports/${slug}?tab=lounges`}>
          {iata} Lounges
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}

export function CompareResults({
  a,
  b,
  membershipAccess,
}: {
  a: CompareSideView;
  b: CompareSideView;
  membershipAccess: HtmlAccess;
}) {
  const identityA = compareSideIdentity(a);
  const identityB = compareSideIdentity(b);
  const bothReady = identityA !== null && identityB !== null;
  const oneReady = (identityA !== null) !== (identityB !== null);
  const scoresA = a.status === "scored" ? a.scores : null;
  const scoresB = b.status === "scored" ? b.scores : null;
  const overallWinner = compareScoreWinner(
    scoresA?.airportistScore,
    scoresB?.airportistScore,
  );
  const returnPath = compareSearchHref(identityA?.iata ?? null, identityB?.iata ?? null);
  const teaserAirport: AirportTeaser | null = identityA
    ? {
        name: identityA.name,
        iata: identityA.iata,
        city: identityA.city,
        country: identityA.country,
        blurb: scoresA?.summary ?? null,
      }
    : identityB
      ? {
          name: identityB.name,
          iata: identityB.iata,
          city: identityB.city,
          country: identityB.country,
          blurb: scoresB?.summary ?? null,
        }
      : null;
  const locked = membershipAccess === "denied";

  return (
    <div className="space-y-6">
      <ReadyPrompt bothReady={bothReady} oneReady={oneReady} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <AirportHeader side={a} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <AirportHeader side={b} />
          </CardContent>
        </Card>
      </div>

      {bothReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Airportist Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr_1fr]">
              <div className="text-sm text-muted-foreground">Overall</div>
              <div className="flex items-end gap-2">
                <span
                  className={cn(
                    "font-mono text-4xl font-semibold tracking-tight",
                    overallWinner === "a" ? "text-primary" : "text-foreground",
                    scoresA ? null : "text-muted-foreground",
                  )}
                >
                  {scoresA ? scoresA.airportistScore.toFixed(1) : "—"}
                </span>
                {scoresA ? (
                  <span className="pb-1 text-sm text-muted-foreground">/ 10</span>
                ) : null}
              </div>
              <div className="flex items-end gap-2">
                <span
                  className={cn(
                    "font-mono text-4xl font-semibold tracking-tight",
                    overallWinner === "b" ? "text-primary" : "text-foreground",
                    scoresB ? null : "text-muted-foreground",
                  )}
                >
                  {scoresB ? scoresB.airportistScore.toFixed(1) : "—"}
                </span>
                {scoresB ? (
                  <span className="pb-1 text-sm text-muted-foreground">/ 10</span>
                ) : null}
              </div>
            </div>

            {SCORE_BREAKDOWN_ROWS.map((row) => {
              const valueA = scoresA?.scoreBreakdown[row.key];
              const valueB = scoresB?.scoreBreakdown[row.key];
              const winner = compareScoreWinner(valueA, valueB);
              return (
                <div
                  key={row.key}
                  className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[10rem_1fr_1fr]"
                >
                  <div className="text-sm text-muted-foreground">{row.label}</div>
                  <ScoreCell value={valueA} winner={winner === "a"} />
                  <ScoreCell value={valueB} winner={winner === "b"} />
                </div>
              );
            })}

            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[10rem_1fr_1fr]">
              <div className="text-sm text-muted-foreground">Summary</div>
              <p className="text-sm leading-6 text-muted-foreground">
                {scoresA?.summary ??
                  (a.status === "unscored"
                    ? a.hasGuide
                      ? "Editorial guide is up. Airportist Score is not generated yet."
                      : "Guide not generated yet."
                    : "—")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {scoresB?.summary ??
                  (b.status === "unscored"
                    ? b.hasGuide
                      ? "Editorial guide is up. Airportist Score is not generated yet."
                      : "Guide not generated yet."
                    : "—")}
              </p>
            </div>

            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[10rem_1fr_1fr]">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Best for
              </div>
              <PhraseList items={scoresA?.bestFor ?? []} variant="secondary" />
              <PhraseList items={scoresB?.bestFor ?? []} variant="secondary" />
            </div>

            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[10rem_1fr_1fr]">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="size-3.5" aria-hidden="true" />
                Watch out for
              </div>
              <PhraseList items={scoresA?.watchOutFor ?? []} variant="outline" />
              <PhraseList items={scoresB?.watchOutFor ?? []} variant="outline" />
            </div>

            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[10rem_1fr_1fr]">
              <div className="text-sm text-muted-foreground">Lounges</div>
              <p className="text-sm leading-6">
                {a.status === "scored" || a.status === "unscored"
                  ? formatLoungeHighlight(a.lounges)
                  : "—"}
              </p>
              <p className="text-sm leading-6">
                {b.status === "scored" || b.status === "unscored"
                  ? formatLoungeHighlight(b.lounges)
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {a.status === "unscored" || b.status === "unscored" ? (
        <p className="text-sm text-muted-foreground">
          Airports without an Airportist Score still show the name we know and a
          link to the airport page. We never invent scores.
        </p>
      ) : null}

      {identityA || identityB ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {identityA ? (
              <AirportLinks slug={identityA.slug} iata={identityA.iata} />
            ) : null}
            {identityB ? (
              <AirportLinks slug={identityB.slug} iata={identityB.iata} />
            ) : null}
          </div>

          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {locked ? <Lock className="size-4" aria-hidden="true" /> : (
                  <Star className="size-4" aria-hidden="true" />
                )}
                Deeper factors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Amenities, traveler tips, disruption narrative, and individual
                lounge pages stay on each airport page. Scores stay free.
              </p>
              <div className="flex flex-wrap gap-2">
                {identityA ? (
                  <>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityA.slug}?tab=tips`}>
                        {identityA.iata} tips
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityA.slug}?tab=disruptions`}>
                        {identityA.iata} disruptions
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityA.slug}?tab=amenities`}>
                        {identityA.iata} amenities
                      </Link>
                    </Button>
                  </>
                ) : null}
                {identityB ? (
                  <>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityB.slug}?tab=tips`}>
                        {identityB.iata} tips
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityB.slug}?tab=disruptions`}>
                        {identityB.iata} disruptions
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/airports/${identityB.slug}?tab=amenities`}>
                        {identityB.iata} amenities
                      </Link>
                    </Button>
                  </>
                ) : null}
              </div>
              {locked && teaserAirport ? (
                <MembershipTeaser
                  variant="panel"
                  heading="Deeper airport intel"
                  teaser={teaserAirport}
                  returnPath={returnPath}
                />
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
