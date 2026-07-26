import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calculator,
  Cloud,
  Coffee,
  Compass,
  Radio,
  RefreshCw,
  Search,
  Train,
  Users,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How the Airportist Score Works",
  description:
    "The Airportist Score methodology: what we measure, how scores are calibrated, which sources inform them, and what the rating does not include.",
  alternates: {
    canonical: "/airportist-score",
  },
  openGraph: {
    title: "How the Airportist Score Works",
    description:
      "A transparent look at HonestAirport's five-factor, AI-assisted editorial airport rating.",
    type: "article",
    url: "/airportist-score",
  },
};

const scoreBands = [
  {
    range: "Below 6.0",
    label: "Material friction",
    description: "Documented pain points such as delays, weak facilities, or difficult flow.",
    width: "60%",
    color: "bg-muted-foreground/35",
  },
  {
    range: "6.0–7.4",
    label: "Solid, with tradeoffs",
    description: "Works well overall, but has specific friction you should plan around.",
    width: "15%",
    color: "bg-chart-3",
  },
  {
    range: "7.5–8.9",
    label: "Very good",
    description: "A strong traveler experience with few consequential complaints.",
    width: "15%",
    color: "bg-chart-2",
  },
  {
    range: "9.0–10",
    label: "Exceptional",
    description: "Best-in-class and unusually complete. Reserved for the Changi tier.",
    width: "10%",
    color: "bg-primary",
  },
] as const;

const scoreFactors = [
  {
    label: "Comfort",
    example: "7.1",
    icon: Coffee,
    description: "Seating, cleanliness, crowding, quiet space, and the ability to rest.",
  },
  {
    label: "Navigation",
    example: "6.7",
    icon: Compass,
    description: "Wayfinding, walking distances, terminal changes, security, and connection friction.",
  },
  {
    label: "Food",
    example: "7.6",
    icon: Utensils,
    description: "Choice, quality, opening-hour coverage, and whether useful options exist after security.",
  },
  {
    label: "Transport",
    example: "7.9",
    icon: Train,
    description: "Speed, price, reliability, luggage-friendliness, and non-car access to the city.",
  },
  {
    label: "Disruption resilience",
    shortLabel: "Disruption",
    example: "7.4",
    icon: Cloud,
    description: "Typical delays, cancellations, operational constraints, and ability to recover.",
  },
] as const;

const process = [
  {
    step: "01",
    title: "Research the airport",
    icon: Search,
    description:
      "We assemble a practical guide from official airport and airline information, operational data, and recent traveler reporting.",
  },
  {
    step: "02",
    title: "Score five dimensions",
    icon: Calculator,
    description:
      "Each dimension receives a 0–10 score to one decimal place. All five have equal influence; there are no hidden premium-airport bonuses.",
  },
  {
    step: "03",
    title: "Calibrate the whole",
    icon: Bot,
    description:
      "Our AI-assisted editorial pipeline sets an overall score close to the five-factor average, then checks it against the published bands.",
  },
  {
    step: "04",
    title: "Publish and refresh",
    icon: RefreshCw,
    description:
      "The score, breakdown, update date, practical guide, and guide sources are published together and refreshed as the airport is revisited.",
  },
] as const;

const excludedSignals = [
  {
    icon: Users,
    title: "Not a traveler-vote average",
    description:
      "Community reviews and the separately labeled Google rating do not change the Airportist Score.",
  },
  {
    icon: Radio,
    title: "Not a live-status score",
    description:
      "Today's weather, security line, or delay spike belongs to live status and does not move the editorial rating in real time.",
  },
  {
    icon: Bot,
    title: "Not a claim of personal inspection",
    description:
      "The system is research-based and AI-assisted. HonestAirport has not personally field-tested every terminal at every scored airport.",
  },
] as const;

export default function AirportistScorePage() {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklab,var(--chart-2)_20%,transparent),transparent_34%),linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--background)),var(--background))]"
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:py-24">
          <div>
            <Badge variant="outline" className="border-primary/25 bg-background/70 font-mono uppercase tracking-[0.12em] text-primary">
              Rating methodology
            </Badge>
            <h1 className="mt-6 max-w-3xl text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              One number should never ask for blind trust.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              The Airportist Score is a 0–10, AI-assisted editorial assessment
              of the traveler experience. Here is exactly what goes into it,
              what stays out, and where judgment enters the process.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/#airport-directory">
                  Browse scored airports
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#five-factors">See the five factors</a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative rounded-3xl border border-primary/15 bg-card/95 p-5 shadow-2xl shadow-primary/10 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Worked example</p>
                  <p className="mt-1 font-mono text-6xl font-semibold tracking-tight text-primary">
                    7.4
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                  / 10
                </span>
              </div>
              <div className="mt-7 space-y-3">
                {scoreFactors.map((factor) => (
                  <div
                    key={factor.label}
                    className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {"shortLabel" in factor ? factor.shortLabel : factor.label}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Number(factor.example) * 10}%` }}
                      />
                    </span>
                    <span className="w-7 text-right font-mono">{factor.example}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                Five-factor average: <span className="font-mono text-foreground">7.3</span>
                <span aria-hidden="true"> · </span>
                Calibrated overall: <span className="font-mono text-foreground">7.4</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            The calibration
          </p>
          <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">
            The same bands apply to every airport
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            A 7.0 means the same thing whether an airport handles five million
            passengers or eighty million. Size sets the context; it does not
            excuse avoidable friction.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div
            aria-hidden="true"
            className="flex h-3 w-full"
          >
            {scoreBands.map((band) => (
              <span
                key={band.label}
                className={band.color}
                style={{ width: band.width }}
              />
            ))}
          </div>
          <div className="grid divide-y divide-border/70 md:grid-cols-4 md:divide-x md:divide-y-0">
            {scoreBands.map((band) => (
              <div key={band.label} className="p-5 sm:p-6">
                <p className="font-mono text-lg font-semibold text-primary">{band.range}</p>
                <h3 className="mt-2 text-base font-semibold">{band.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {band.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="five-factors" className="scroll-mt-20 border-y border-border/70 bg-muted/35">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              The five factors
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">
              Equal influence, visible separately
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The breakdown prevents a polished lounge or a fast train from
              masking weak performance elsewhere. Every airport page shows all
              five values.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {scoreFactors.map((factor) => {
              const Icon = factor.icon;
              return (
                <Card key={factor.label} className="border-border/70 bg-card/90">
                  <CardHeader>
                    <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-heading text-base leading-snug font-medium">
                      {factor.label}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {factor.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              How a score is made
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">
              From research to a published rating
            </h2>
            <div className="mt-10">
              {process.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="relative grid grid-cols-[44px_1fr] gap-4 pb-9 last:pb-0"
                  >
                    {index < process.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-11 bottom-0 left-[21px] w-px bg-border"
                      />
                    ) : null}
                    <span className="relative z-10 flex size-11 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="pt-1">
                      <p className="font-mono text-xs text-muted-foreground">STEP {item.step}</p>
                      <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="h-fit border-primary/20 bg-primary/[0.045] lg:sticky lg:top-20">
            <CardHeader>
              <h3 className="font-heading text-xl leading-snug font-medium">
                Where judgment enters
              </h3>
              <CardDescription>Why the overall score may differ from the simple average.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                The five dimensions have equal influence, but the final number
                is a holistic editorial calibration—not a weighted formula.
                It stays close to their arithmetic mean while accounting for
                the severity of an airport&apos;s defining strength or pain point.
              </p>
              <p>
                We show both the calculated average and the published score on
                every scored airport page, so any adjustment is visible.
              </p>
              <div className="rounded-xl border border-primary/15 bg-background/75 p-4 text-foreground">
                <p className="font-medium">No hidden precision</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Scores use one decimal place to support comparison, not to
                  imply scientific certainty.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-border/70 bg-card">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              Important limits
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">
              What the score does not mean
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {excludedSignals.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-border/70 p-5 sm:p-6">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/35 p-5 sm:p-6">
            <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
              Sources vary by airport. The guide&apos;s Sources section lists
              the references used for that airport&apos;s researched content.
              Airportist Scores are editorial content, not an airport
              certification, safety rating, or statistically representative
              passenger survey.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8 sm:py-10 md:flex-row md:items-center">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.14em] uppercase opacity-75">
              Put the rubric to work
            </p>
            <h2 className="mt-2 text-2xl tracking-tight sm:text-3xl">
              Compare airports with the same yardstick.
            </h2>
          </div>
          <Button asChild size="lg" variant="secondary" className="shrink-0">
            <Link href="/#airport-directory">
              Browse the directory
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
