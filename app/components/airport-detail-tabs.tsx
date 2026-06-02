import type { ReactNode } from "react";
import {
  Baby,
  Bus,
  Camera,
  Car,
  CheckCircle2,
  Coffee,
  DoorOpen,
  Info,
  Map,
  ShieldCheck,
  Sparkles,
  Star,
  Train,
  Utensils,
  Wifi,
} from "lucide-react";
import {
  AirportLiveStatusPanel,
  AirportLiveStatusProvider,
} from "@/app/components/airport-live-status-loader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  amenityLabel,
  tipCategoryLabel,
} from "@/lib/airport-utils";
import { cn } from "@/lib/utils";
import type { AirportGuideSection, AirportGuideSummary } from "@/lib/airport-content";
import type { Airport, AmenityCategory } from "@/lib/types";

interface AirportDetailTabsProps {
  airport: Airport;
  guide?: AirportGuideSummary | null;
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

function formatGuideDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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

export function AirportDetailTabs({ airport, guide }: AirportDetailTabsProps) {
  const guideSections = guide?.sections;
  const hasGettingThereGuide = Boolean(
    guideSections?.terminalNavigation?.items.length ||
      guideSections?.groundTransport?.items.length,
  );

  return (
    <AirportLiveStatusProvider iata={airport.iata}>
      <Tabs defaultValue="overview" className="gap-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max" variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="getting-there">Getting There</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="tips">Traveler Tips</TabsTrigger>
            <TabsTrigger value="disruptions">Disruptions</TabsTrigger>
            <TabsTrigger value="reviews">Reviews & Photos</TabsTrigger>
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

        {guide?.quickFacts.length ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Guide quick facts</CardTitle>
                  <CardDescription>
                    Pulled from the editorial markdown guide for {airport.iata}.
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
              {guide.sources.length ? (
                <p className="text-xs text-muted-foreground">
                  Editorial guide cites {guide.sources.length} official{" "}
                  {guide.sources.length === 1 ? "source" : "sources"}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

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
          {airport.transport.map((option) => (
            <Card key={`${option.type}-${option.name}`} className="h-full">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-5">
                  <TransportIcon type={option.type} />
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
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="amenities" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {airport.amenities.map((amenity) => (
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

        {airport.tips.map((tip, index) => (
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

      <TabsContent value="reviews" className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {airport.reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{review.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {review.author} · {review.tripType} · {review.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          "size-4",
                          index < review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30",
                        )}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {review.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4" aria-hidden="true" />
              Photo Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {airport.photos.map((photo) => (
              <Dialog key={photo.id}>
                <DialogTrigger className="text-left">
                  <div
                    className={cn(
                      "flex h-28 items-end rounded-2xl bg-gradient-to-br p-4 text-sm font-medium text-white shadow-sm transition hover:scale-[1.01]",
                      photo.colorClass,
                    )}
                  >
                    {photo.alt}
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{photo.alt}</DialogTitle>
                    <DialogDescription>
                      Placeholder photo treatment for the MVP starter. Replace with
                      `next/image` assets when production photos are available.
                    </DialogDescription>
                  </DialogHeader>
                  <div
                    className={cn(
                      "h-72 rounded-2xl bg-gradient-to-br",
                      photo.colorClass,
                    )}
                  />
                </DialogContent>
              </Dialog>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </AirportLiveStatusProvider>
  );
}
