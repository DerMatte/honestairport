import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CompareResults } from "@/app/components/compare-results";
import type { CompareSideView } from "@/lib/compare-airports";

const empty: CompareSideView = { status: "empty" };

const scoredLga: CompareSideView = {
  status: "scored",
  identity: {
    iata: "LGA",
    slug: "lga",
    name: "LaGuardia Airport",
    city: "New York",
    country: "United States",
  },
  scores: {
    airportistScore: 4.2,
    scoreBreakdown: {
      comfort: 3.5,
      navigation: 4.0,
      food: 4.8,
      transport: 6.1,
      disruptionResilience: 3.2,
    },
    summary: "A rebuild that still feels like a rebuild.",
    bestFor: ["Domestic hops"],
    watchOutFor: ["Walks"],
    disruptionStatus: "minor",
  },
  lounges: {
    total: 3,
    worthIt: 1,
    depends: 1,
    skip: 1,
    unlabeled: 0,
  },
};

const scoredSin: CompareSideView = {
  status: "scored",
  identity: {
    iata: "SIN",
    slug: "sin",
    name: "Singapore Changi Airport",
    city: "Singapore",
    country: "Singapore",
  },
  scores: {
    airportistScore: 9.1,
    scoreBreakdown: {
      comfort: 9.4,
      navigation: 9.0,
      food: 8.8,
      transport: 9.2,
      disruptionResilience: 8.9,
    },
    summary: "The airport other airports are compared against.",
    bestFor: ["Layovers"],
    watchOutFor: ["Pricey food"],
    disruptionStatus: "normal",
  },
  lounges: {
    total: 12,
    worthIt: 8,
    depends: 3,
    skip: 1,
    unlabeled: 0,
  },
};

test("empty compare state asks for two airports", () => {
  const html = renderToStaticMarkup(
    <CompareResults a={empty} b={empty} membershipAccess="open" />,
  );

  assert.match(html, /Pick two airports to compare scores side by side/);
  assert.doesNotMatch(html, />Overall</);
  assert.doesNotMatch(html, /Disruption resilience/);
});

test("one-sided compare asks for a second airport", () => {
  const html = renderToStaticMarkup(
    <CompareResults a={scoredLga} b={empty} membershipAccess="open" />,
  );

  assert.match(html, /Pick a second airport to compare scores/);
  assert.match(html, /LaGuardia Airport/);
  assert.match(html, /href="\/airports\/lga"/);
  assert.match(html, /href="\/airports\/lga\?tab=lounges"/);
});

test("invalid IATA is a friendly error, not a crash", () => {
  const html = renderToStaticMarkup(
    <CompareResults
      a={{ status: "invalid", raw: "nope" }}
      b={{ status: "unknown", iata: "ZZZ" }}
      membershipAccess="open"
    />,
  );

  assert.match(html, /nope isn’t a valid IATA code/);
  assert.match(html, /We don’t recognize ZZZ/);
});

test("free compare shows scores, breakdown, lounge mix, and airport links", () => {
  const html = renderToStaticMarkup(
    <CompareResults a={scoredLga} b={scoredSin} membershipAccess="open" />,
  );

  assert.match(html, /4\.2/);
  assert.match(html, /9\.1/);
  assert.match(html, /Comfort/);
  assert.match(html, /Disruption resilience/);
  assert.match(html, /3 lounges · 1 worth-it · 1 depends · 1 skip/);
  assert.match(html, /12 lounges · 8 worth-it · 3 depends · 1 skip/);
  assert.match(html, /href="\/airports\/lga"/);
  assert.match(html, /href="\/airports\/sin\?tab=lounges"/);
  assert.match(html, /href="\/airports\/lga\?tab=tips"/);
  assert.doesNotMatch(html, /Unlock Deeper airport intel/);
});

test("denied membership shows the existing Whop teaser, not paid tab bodies", () => {
  const html = renderToStaticMarkup(
    <CompareResults a={scoredLga} b={scoredSin} membershipAccess="denied" />,
  );

  assert.match(html, /Unlock Deeper airport intel/);
  assert.match(html, /href="\/members\?next=%2Fcompare%3Fa%3Dlga%26b%3Dsin#restore"/);
  assert.doesNotMatch(html, /Average security/);
  assert.doesNotMatch(html, /Priority Pass/);
});
