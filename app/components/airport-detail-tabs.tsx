import type { ReactNode } from "react";
import {
  Baby,
  Bus,
  Car,
  CheckCircle2,
  Coffee,
  DoorOpen,
  ExternalLink,
  Droplets,
  Info,
  Luggage,
  Map,
  ShieldCheck,
  Sparkles,
  Train,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { AirportGuideArticle } from "@/app/components/airport-guide-article";
import {
  AirportLiveStatusPanel,
  AirportLiveStatusProvider,
} from "@/app/components/airport-live-status-loader";
import { AirportLocalTime } from "@/app/components/airport-local-time";
import { AirportLoungeGrid } from "@/app/components/airport-lounges";
import { AirportWaterOptionGrid } from "@/app/components/airport-water-bottle";
import { AirportGuideSources } from "@/app/components/airport-guide-sources";
import { AirportReviews } from "@/app/components/airport-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAirportByIata } from "@/lib/airports";
import {
  amenityLabel,
  pickTransportRecommendations,
  tipCategoryLabel,
} from "@/lib/airport-utils";
import { buildRideshareDeepLink, getRideshareProviders } from "@/lib/rideshare";
import { formatGuideDate } from "@/lib/utils";
import type { AirportGuideSection, AirportGuideSummary } from "@/lib/airport-content";
import { filterWaterRelatedGuideItems } from "@/lib/airport-content";
import type { AirportUserReview } from "@/lib/review-schema";
import type { Airport, AmenityCategory, TransportBestFor } from "@/lib/types";

interface AirportDetailTabsProps {
  /** Curated airport record; omit for guide-only airports. */
  airport?: Airport;
  guide?: AirportGuideSummary | null;
  /** Required when no curated airport record is passed. */
  iata?: string;
  /** Full markdown guide body; when set, renders a Full Guide tab. */
  guideMarkdown?: string;
  /** Editorial reviews shown alongside live community reviews. */
  seedReviews?: AirportUserReview[];
}

function amenityIcon(category: AmenityCategory) {
  switch (category) {
    case "food":
      return <Utensils aria-hidden="true" />;
    case "lounge":
      return <DoorOpen aria-hidden="true" />;
    case "wifi":
      return <Wifi aria-hidden="true" />;
    case "family":
      return <Baby aria-hidden="true" />;
    case "accessibility":
      return <CheckCircle2 aria-hidden="true" />;
    case "transport":
      return <Train aria-hidden="true" />;
    case "shopping":
      return <Sparkles aria-hidden="true" />;
    case "sleep":
      return <Coffee aria-hidden="true" />;
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

function ScoreMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={value * 10} />
    </div>
  );
}

function GuideSectionCard({
  className,
  description,
  icon,
  section,
  title,
}: {
  className?: string;
  description: string;
  icon: ReactNode;
  section?: AirportGuideSection;
  title: string;
}) {
  if (!section?.items.length) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
            {icon}
          </div>
        </div>
        <Badge variant="outline" className="w-fit rounded-full">
          From {section.title}
        </Badge>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {section.items.map((item, index) => (
            <li key={`${section.title}-${index}`} className="flex gap-3 text-sm leading-6">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TransportIcon({ type }: { type: Airport["transport"][number]["type"] }) {
  switch (type) {
    case "train":
    case "metro":
      return <Train aria-hidden="true" />;
    case "bus":
      return <Bus aria-hidden="true" />;
    case "taxi":
    case "rideshare":
      return <Car aria-hidden="true" />;
    case "parking":
      return <Map aria-hidden="true" />;
    default: {
      const exhaustiveCheck: never = type;
      return exhaustiveCheck;
    }
  }
}

function TransportBestForBadge({ type }: { type: TransportBestFor }) {
  switch (type) {
    case "fastest":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
        >
          <Zap className="size-3" aria-hidden="true" />
          Fastest
        </Badge>
      );
    case "cheapest":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <Wallet className="size-3" aria-hidden="true" />
          Cheapest
        </Badge>
      );
    case "luggage":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        >
          <Luggage className="size-3" aria-hidden="true" />
          Best for luggage
        </Badge>
      );
    default: {
      const exhaustiveCheck: never = type;
      return exhaustiveCheck;
    }
  }
}
function waterGuideSection(
  section: AirportGuideSection | undefined,
): AirportGuideSection | undefined {
  if (!section) {
    return undefined;
  }

  const items = filterWaterRelatedGuideItems(section.items);
  if (!items.length) {
    return undefined;
  }

  return {
    title: section.title,
    items,
  };
}

function collectWaterGuideSections(
  guideSections: AirportGuideSummary["sections"] | undefined,
): AirportGuideSection[] {
  if (!guideSections) {
    return [];
  }

  const sections = [
    guideSections.waterHydration,
    waterGuideSection(guideSections.foodAndDrink),
    waterGuideSection(guideSections.budgetTravelerTips),
    waterGuideSection(guideSections.loungesAmenities),
    waterGuideSection(guideSections.airportTricks),
  ].filter((section): section is AirportGuideSection => Boolean(section?.items.length));

  const seen = new Set<string>();
  return sections.filter((section) => {
    const key = `${section.title}:${section.items.join("|")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function AirportDetailTabs({
  airport,
  guide,
  iata: iataProp,
  guideMarkdown,
  seedReviews,
}: AirportDetailTabsProps) {
  const iata = airport?.iata ?? iataProp;

  if (!iata) {
    return null;
  }

  const airportRecord = getAirportByIata(iata);
  const transportRecommendations = airport?.transport.length
    ? pickTransportRecommendations(airport.transport)
    : {};
  const rideshareProviders = airportRecord
    ? getRideshareProviders(airportRecord.iata_country_code)
    : [];
  // Rideshare deep links live inside this option's own card since it's the
  // closest match; airports without a taxi/rideshare entry get a standalone
  // card instead (see the fallback after the transport grid below).
  const rideBookingOption = airport?.transport.find(
    (option) => option.type === "taxi" || option.type === "rideshare",
  );

  const guideSections = guide?.sections;
  const hasGettingThereGuide = Boolean(
    guideSections?.terminalNavigation?.items.length ||
      guideSections?.groundTransport?.items.length,
  );
  const showGettingThere = Boolean(airport) || hasGettingThereGuide;
  const showLounges = Boolean(
    airport ||
      guide?.lounges.length ||
      guideSections?.loungesAmenities?.items.length,
  );
  const showAmenities = Boolean(airport?.amenities.length);
  const showTips = Boolean(
    airport?.tips.length || guideSections?.airportTricks?.items.length,
  );
  const waterGuideSections = collectWaterGuideSections(guideSections);
  const showWater = Boolean(guide?.waterOptions.length || waterGuideSections.length);

  return (
    <AirportLiveStatusProvider iata={iata}>
      <Tabs defaultValue="overview" className="gap-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max" variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {showGettingThere ? (
              <TabsTrigger value="getting-there">Getting There</TabsTrigger>
            ) : null}
            {showLounges ? <TabsTrigger value="lounges">Lounges</TabsTrigger> : null}
            {showAmenities ? (
              <TabsTrigger value="amenities">Amenities</TabsTrigger>
            ) : null}
            {showTips ? <TabsTrigger value="tips">Traveler Tips</TabsTrigger> : null}
            {showWater ? <TabsTrigger value="water">Water</TabsTrigger> : null}
            {guideMarkdown ? (
              <TabsTrigger value="guide">Full Guide</TabsTrigger>
            ) : null}
            <TabsTrigger value="disruptions">Disruptions</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <section aria-labelledby="live-status-heading" className="space-y-3">
            <div>
              <p className="text-sm font-medium text-primary">Live airport status</p>
              <h2 id="live-status-heading" className="text-2xl font-semibold tracking-tight">
                Current operations
              </h2>
            </div>
            <AirportLiveStatusPanel className="mb-0" />
          </section>

        {/* Guide-only pages already surface quick facts in the hero card, so
            repeat them here only for curated airports (whose hero shows the
            Airportist Score instead). */}
        {airport && guide?.quickFacts.length ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Guide quick facts</CardTitle>
                  <CardDescription>
                    Pulled from the editorial markdown guide for {iata}.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  Updated {formatGuideDate(guide.lastUpdated)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="grid gap-3 md:grid-cols-2">
                {guide.quickFacts.slice(0, 6).map((fact, index) => (
                  <li
                    key={`${fact}-${index}`}
                    className="flex gap-3 rounded-xl border bg-muted/30 p-3 text-sm leading-6"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
              {guide.sourceLinks.length ? (
                <AirportGuideSources sources={guide.sourceLinks} />
              ) : null}
            </CardContent>
          </Card>
        ) : guide?.sourceLinks.length ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Guide sources</CardTitle>
                  <CardDescription>
                    References behind the editorial guide for {iata}.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  Updated {formatGuideDate(guide.lastUpdated)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AirportGuideSources sources={guide.sourceLinks} />
            </CardContent>
          </Card>
        ) : null}

        {airport ? (
        <>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Airportist Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ScoreMetric label="Comfort" value={airport.scoreBreakdown.comfort} />
              <ScoreMetric label="Navigation" value={airport.scoreBreakdown.navigation} />
              <ScoreMetric label="Food" value={airport.scoreBreakdown.food} />
              <ScoreMetric label="Transport" value={airport.scoreBreakdown.transport} />
              <ScoreMetric
                label="Disruption resilience"
                value={airport.scoreBreakdown.disruptionResilience}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                ["Annual passengers", airport.stats.annualPassengers],
                ["Terminals", airport.stats.terminals],
                ["On-time departures", `${airport.stats.onTimePercentage}%`],
                ["Avg security", `${airport.stats.averageSecurityMinutes} min`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 font-mono text-lg">{value}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Best For
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {airport.bestFor.map((item) => (
                <Badge key={item} variant="secondary" className="rounded-full">
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4" aria-hidden="true" />
                Watch Out For
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {airport.watchOutFor.map((item) => (
                <Badge key={item} variant="outline" className="rounded-full">
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
        </>
        ) : null}
      </TabsContent>

      <TabsContent value="getting-there" className="space-y-4">
        {hasGettingThereGuide ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <GuideSectionCard
              description="Terminal-change and gate-area notes pulled from the markdown guide."
              icon={<Map aria-hidden="true" />}
              section={guideSections?.terminalNavigation}
              title="Terminal navigation guide"
            />
            <GuideSectionCard
              description="City-transfer, rideshare, train, and parking guidance from the markdown guide."
              icon={<Train aria-hidden="true" />}
              section={guideSections?.groundTransport}
              title="Ground transport guide"
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {airport?.transport.map((option) => {
            const badges = (["fastest", "cheapest", "luggage"] as const).filter(
              (key) => transportRecommendations[key] === option,
            );
            const showRideBooking =
              option === rideBookingOption && Boolean(airportRecord) && rideshareProviders.length > 0;

            return (
            <Card key={`${option.type}-${option.name}`} className="h-full">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-5">
                    <TransportIcon type={option.type} />
                  </div>
                  {badges.length ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {badges.map((key) => (
                        <TransportBestForBadge key={key} type={key} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <CardTitle>{option.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">{option.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Time</div>
                    <div className="mt-1 font-mono">{option.timeToCity}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="mt-1 font-mono">{option.cost}</div>
                  </div>
                </div>
                <p className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">
                  Tip: {option.insiderTip}
                </p>
                {showRideBooking && airportRecord ? (
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {rideshareProviders.map((provider) => (
                        <Button key={provider.id} asChild variant="outline" size="sm">
                          <a
                            href={buildRideshareDeepLink(provider.id, {
                              latitude: airportRecord.latitude,
                              longitude: airportRecord.longitude,
                              nickname: airport?.shortName ?? airportRecord.name,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {provider.label}
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      ))}
                      <AirportLocalTime
                        timeZone={airportRecord.time_zone}
                        label={`Local time at ${iata}:`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Opens the app with pickup set to the airport so you can check the live
                      price and ETA there.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            );
          })}
        </div>

        {!rideBookingOption && airportRecord && rideshareProviders.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="size-4" aria-hidden="true" />
                Book a ride from {iata}
              </CardTitle>
              <CardDescription>
                Opens the app with pickup set to the airport so you can check the live price
                and ETA there — we don&apos;t show a static estimate for rideshare since real
                pricing is only accurate inside the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {rideshareProviders.map((provider) => (
                <Button key={provider.id} asChild variant="outline">
                  <a
                    href={buildRideshareDeepLink(provider.id, {
                      latitude: airportRecord.latitude,
                      longitude: airportRecord.longitude,
                      nickname: airport?.shortName ?? airportRecord.name,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {provider.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ))}
              <AirportLocalTime
                timeZone={airportRecord.time_zone}
                label={`Local time at ${iata}:`}
              />
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="lounges" className="space-y-4">
        {guide?.lounges.length ? (
          <AirportLoungeGrid lounges={guide.lounges} />
        ) : null}

        <GuideSectionCard
          description="Lounge, food, and quiet-spot picks pulled from the markdown guide."
          icon={<DoorOpen aria-hidden="true" />}
          section={guideSections?.loungesAmenities}
          title="Lounge & amenity notes"
        />

        {!guide?.lounges.length && !guideSections?.loungesAmenities?.items.length ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No lounge intel yet for {iata}. Check the official airport site for
              current lounge locations and access rules.
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="amenities" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {airport?.amenities.map((amenity) => (
          <Card key={amenity.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-5">
                  {amenityIcon(amenity.category)}
                </div>
                <Badge
                  variant={amenity.quality === "excellent" ? "default" : "secondary"}
                  className="rounded-full"
                >
                  {amenity.quality}
                </Badge>
              </div>
              <CardTitle>{amenity.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="mb-3 rounded-full">
                {amenityLabel(amenity.category)}
              </Badge>
              <p className="text-sm leading-6 text-muted-foreground">
                {amenity.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="tips" className="space-y-4">
        <GuideSectionCard
          description="The markdown guide's highest-signal tactics before the data-backed tips below."
          icon={<Sparkles aria-hidden="true" />}
          section={guideSections?.airportTricks}
          title="Editorial guide tricks"
        />

        {airport?.tips.map((tip, index) => (
          <Card key={tip.id}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[80px_1fr]">
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  {String(index + 1).padStart(2, "0")}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {tipCategoryLabel(tip.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Traveler Tips & Hacks
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{tip.title}</h3>
                <p className="mt-2 text-sm font-medium">{tip.summary}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tip.details}</p>
                {(tip.pro || tip.con) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {tip.pro ? (
                      <div className="rounded-xl border bg-emerald-500/10 p-3 text-sm">
                        <div className="font-medium text-emerald-700 dark:text-emerald-300">
                          Pro
                        </div>
                        <p className="mt-1 text-muted-foreground">{tip.pro}</p>
                      </div>
                    ) : null}
                    {tip.con ? (
                      <div className="rounded-xl border bg-orange-500/10 p-3 text-sm">
                        <div className="font-medium text-orange-700 dark:text-orange-300">
                          Watch-out
                        </div>
                        <p className="mt-1 text-muted-foreground">{tip.con}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="water" className="space-y-4">
        {guide?.waterOptions.length ? (
          <AirportWaterOptionGrid options={guide.waterOptions} />
        ) : null}

        {waterGuideSections.map((section) => (
          <GuideSectionCard
            key={section.title}
            description="Hydration notes pulled from the editorial guide."
            icon={<Droplets aria-hidden="true" />}
            section={section}
            title={section.title}
          />
        ))}

        {!guide?.waterOptions.length && !waterGuideSections.length ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No water-bottle intel yet for {iata}. Bring an empty bottle through
              security and look for refill fountains airside.
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      {guideMarkdown ? (
        <TabsContent value="guide" className="max-w-4xl">
          <AirportGuideArticle content={guideMarkdown} />
        </TabsContent>
      ) : null}

      <TabsContent value="disruptions">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" aria-hidden="true" />
              Current Disruptions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Live operational signals from Flighty or FAA, plus checkpoint waits where airports publish them.
            </p>
          </CardHeader>
          <CardContent>
            <AirportLiveStatusPanel />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reviews">
        <AirportReviews
          iata={iata}
          seedReviews={seedReviews}
          className="max-w-3xl"
        />
      </TabsContent>
      </Tabs>
    </AirportLiveStatusProvider>
  );
}
