import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEED_CARDS = [
  {
    title: "Your Priority Pass app lists a lounge. We say skip.",
    body: "Nantes (NTE) — Les Brasses (Hall 1) is a Priority Pass / LoungeKey restaurant visit (dining credit against the bill), not a soft lounge. Walk-in pays the full bill. No buffet, showers, or quiet workroom; the desk can refuse when busy. Free directory verdict: skip.",
    links: [
      { href: "/airports/nte?tab=lounges", label: "NTE lounge directory" },
    ],
  },
  {
    title: "The rebuild looks fine inside B/C. Landside still isn’t.",
    body: "LaGuardia scores 6.4. No AirTrain. Weather or a Grand Central Parkway jam leaves almost no backup — after bank delays, curb/rideshare can take longer than the flight. Free overview: GCP/East River 25 min off-peak → 70+ rush; terminals A/B/C aren’t sterile-connected. Members unlock the Disruptions tab.",
    links: [{ href: "/airports/lga", label: "LGA overview" }],
  },
  {
    title: "Famous ≠ top-10.",
    body: "Singapore Changi 9.2 (comfort 9.5, disruption resilience 9.0) vs LaGuardia 6.4 (comfort 7.4 insides; transport 5.0; disruption resilience 5.5 — curb, no AirTrain, Manhattan traffic). 297 scored airports. Scores are free; the decision layer is members.",
    links: [
      { href: "/airports/sin", label: "SIN" },
      { href: "/airports/lga", label: "LGA" },
    ],
  },
] as const;

export function MembersKnowBeforeYouGo({
  checkoutHref,
  showJoinCta,
}: {
  checkoutHref: string;
  showJoinCta: boolean;
}) {
  return (
    <section className="mt-14 sm:mt-16" aria-labelledby="know-before-you-go">
      <h2
        id="know-before-you-go"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Know before you go
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {SEED_CARDS.map((card) => (
          <Card
            key={card.title}
            className="h-full border-border/70 bg-card/95 shadow-sm"
          >
            <CardHeader>
              <CardTitle className="text-lg font-semibold tracking-tight text-balance">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {card.body}
              </p>
              <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                {card.links.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ))}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showJoinCta ? (
        <div className="mt-6">
          <Button size="lg" className="h-11 px-5 text-base" asChild>
            <a href={checkoutHref} rel="noopener noreferrer">
              Join members · $8/mo
            </a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
