import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareScoreWinner,
  compareSideIata,
  compareSideIdentity,
  formatLoungeHighlight,
  identityFromAirport,
  identityFromFrontmatter,
  identityFromRecord,
  loungeVerdictCounts,
  scoresFromAirport,
} from "./compare-airports";
import type { Airport } from "./types";

const airport = {
  slug: "lga",
  iata: "LGA",
  name: "LaGuardia Airport",
  city: "New York",
  country: "United States",
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
  disruption: { status: "minor" },
} as Airport;

describe("loungeVerdictCounts", () => {
  it("counts worth-it / depends / skip and unlabeled lounges", () => {
    assert.deepEqual(
      loungeVerdictCounts([
        { verdict: "worth-it" },
        { verdict: "worth-it" },
        { verdict: "depends" },
        { verdict: "skip" },
        {},
        { verdict: null },
      ]),
      {
        total: 6,
        worthIt: 2,
        depends: 1,
        skip: 1,
        unlabeled: 2,
      },
    );
  });

  it("returns zeros for an empty lounge list", () => {
    assert.deepEqual(loungeVerdictCounts([]), {
      total: 0,
      worthIt: 0,
      depends: 0,
      skip: 0,
      unlabeled: 0,
    });
  });
});

describe("formatLoungeHighlight", () => {
  it("summarizes the mix without dumping lounge pages", () => {
    assert.equal(formatLoungeHighlight(loungeVerdictCounts([])), "No lounge directory yet");
    assert.equal(
      formatLoungeHighlight(
        loungeVerdictCounts([{ verdict: "worth-it" }, { verdict: "skip" }]),
      ),
      "2 lounges · 1 worth-it · 1 skip",
    );
    assert.equal(
      formatLoungeHighlight(loungeVerdictCounts([{}])),
      "1 lounge",
    );
  });
});

describe("identity helpers", () => {
  it("normalizes IATA and slug from a scored airport", () => {
    assert.deepEqual(identityFromAirport(airport), {
      iata: "LGA",
      slug: "lga",
      name: "LaGuardia Airport",
      city: "New York",
      country: "United States",
    });
  });

  it("falls back to city_name and country code on a static record", () => {
    assert.deepEqual(
      identityFromRecord({
        city_name: "Queens",
        iata_city_code: "NYC",
        iata_country_code: "US",
        icao_code: "KLGA",
        iata_code: "lga",
        latitude: 0,
        longitude: 0,
        city: null,
        time_zone: "America/New_York",
        name: "LaGuardia",
        id: "lga",
      }),
      {
        iata: "LGA",
        slug: "lga",
        name: "LaGuardia",
        city: "Queens",
        country: "US",
      },
    );
  });

  it("uses guide frontmatter when present", () => {
    assert.deepEqual(
      identityFromFrontmatter({
        iata: "sin",
        name: "Singapore Changi Airport",
        city: "Singapore",
        country: "Singapore",
      }),
      {
        iata: "SIN",
        slug: "sin",
        name: "Singapore Changi Airport",
        city: "Singapore",
        country: "Singapore",
      },
    );
  });
});

describe("scoresFromAirport", () => {
  it("copies free score fields without inventing values", () => {
    assert.deepEqual(scoresFromAirport(airport), {
      airportistScore: 4.2,
      scoreBreakdown: airport.scoreBreakdown,
      summary: airport.summary,
      bestFor: ["Domestic hops"],
      watchOutFor: ["Walks"],
      disruptionStatus: "minor",
    });
  });
});

describe("compareScoreWinner", () => {
  it("picks the higher score and treats missing values as none/other", () => {
    assert.equal(compareScoreWinner(9.1, 4.2), "a");
    assert.equal(compareScoreWinner(4.2, 9.1), "b");
    assert.equal(compareScoreWinner(7, 7), "tie");
    assert.equal(compareScoreWinner(undefined, undefined), "none");
    assert.equal(compareScoreWinner(8, undefined), "a");
    assert.equal(compareScoreWinner(undefined, 8), "b");
  });
});

describe("compare side accessors", () => {
  it("reads identity and IATA from shaped sides", () => {
    const scored = {
      status: "scored" as const,
      identity: identityFromAirport(airport),
      scores: scoresFromAirport(airport),
      lounges: loungeVerdictCounts([]),
    };
    assert.equal(compareSideIata(scored), "LGA");
    assert.equal(compareSideIdentity({ status: "empty" }), null);
    assert.equal(compareSideIata({ status: "invalid", raw: "nope" }), null);
    assert.equal(compareSideIata({ status: "unknown", iata: "ZZZ" }), "ZZZ");
  });
});
