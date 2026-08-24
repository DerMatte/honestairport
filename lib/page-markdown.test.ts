import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBlockedMarkdownPath,
  markdownRewritePath,
  preferredPageType,
  prefersMarkdown,
  publicMarkdownPath,
} from "./markdown-negotiate";
import {
  buildAirportPageMarkdown,
  buildAirportTabMarkdown,
  buildHomeMarkdown,
  buildLlmsTxt,
  buildLoungePageMarkdown,
  buildSitemapMarkdown,
  mdHref,
} from "./page-markdown";
import type { AirportContent } from "./airport-guides";
import type { AirportLoungeView } from "./lounge-directory";
import type { Airport } from "./types";

describe("preferredPageType", () => {
  it("returns null for missing or wildcard-only Accept", () => {
    assert.equal(preferredPageType(null), null);
    assert.equal(preferredPageType(""), null);
    assert.equal(preferredPageType("*/*"), null);
  });

  it("prefers markdown when it outranks html", () => {
    assert.equal(
      preferredPageType("text/markdown, text/html;q=0.9"),
      "text/markdown",
    );
    assert.equal(prefersMarkdown("text/markdown,text/html;q=0.1"), true);
  });

  it("prefers html when it outranks or ties markdown", () => {
    assert.equal(
      preferredPageType("text/html, text/markdown;q=0.1"),
      "text/html",
    );
    assert.equal(
      preferredPageType("text/html;q=0.8, text/markdown;q=0.8"),
      "text/html",
    );
    assert.equal(prefersMarkdown("text/html,application/xhtml+xml"), false);
  });
});

describe("markdown path helpers", () => {
  it("maps public paths to /md handlers", () => {
    assert.equal(markdownRewritePath("/"), "/md");
    assert.equal(markdownRewritePath("/.md"), "/md");
    assert.equal(markdownRewritePath("/index.md"), "/md");
    assert.equal(markdownRewritePath("/sitemap.md"), "/md/sitemap");
    assert.equal(markdownRewritePath("/airports/lax"), "/md/airports/lax");
    assert.equal(markdownRewritePath("/airports/LAX.md"), "/md/airports/lax");
    assert.equal(
      markdownRewritePath("/airports/lax/lounge/star-alliance.md"),
      "/md/airports/lax/lounge/star-alliance",
    );
    assert.equal(
      markdownRewritePath("/airports/lax/getting-there.md"),
      "/md/airports/lax/getting-there",
    );
    assert.equal(
      markdownRewritePath("/airports/lax/water.md"),
      "/md/airports/lax/water",
    );
    assert.equal(
      markdownRewritePath("/airports/lax/lounges.md"),
      "/md/airports/lax/lounges",
    );
  });

  it("blocks private .md paths and round-trips canonical URLs", () => {
    assert.equal(isBlockedMarkdownPath("/login.md"), true);
    assert.equal(isBlockedMarkdownPath("/settings.md"), true);
    assert.equal(isBlockedMarkdownPath("/airports/lax.md"), false);
    assert.equal(publicMarkdownPath("/md"), "/index.md");
    assert.equal(publicMarkdownPath("/md/airports/lax"), "/airports/lax.md");
    assert.equal(
      publicMarkdownPath("/md/airports/lax/lounge/star"),
      "/airports/lax/lounge/star.md",
    );
    assert.equal(
      publicMarkdownPath("/md/airports/lax/getting-there"),
      "/airports/lax/getting-there.md",
    );
    assert.equal(
      publicMarkdownPath("/md/airports/lax/lounges"),
      "/airports/lax/lounges.md",
    );
  });
});

describe("markdown builders", () => {
  const guide: AirportContent = {
    frontmatter: {
      iata: "LAX",
      name: "Los Angeles International Airport",
      city: "Los Angeles",
      country: "United States",
      lastUpdated: "2026-08-01",
      quickFacts: ["Big hub"],
    },
    content: "## Best Airport Tricks & Hacks\n\n- Tip one\n",
  };

  const lounge: AirportLoungeView = {
    slug: "star-alliance-lounge",
    name: "Star Alliance Lounge",
    terminal: "TBIT",
    access: [{ program: "star-alliance-gold" }],
    amenities: ["Wi-Fi"],
    bestFor: ["Long-haul"],
    summary: "Solid TBIT option.",
    status: "open",
    sourceUrls: [],
  };

  it("uses root-relative links on the home and nested sitemap", () => {
    assert.equal(mdHref("airports/lax.md"), "/airports/lax.md");

    const home = buildHomeMarkdown({
      scored: [],
      guides: [
        {
          iata: "LAX",
          name: "Los Angeles International Airport",
          city: "Los Angeles",
          country: "United States",
          lastUpdated: "2026-08-01",
        },
      ],
    });
    assert.match(home, /\]\(\/airports\/lax\.md\)/);
    assert.doesNotMatch(home, /https:\/\/www\.honestairport\.com\/airports/);

    const sitemap = buildSitemapMarkdown({
      scored: [],
      guides: [
        {
          iata: "LAX",
          name: "Los Angeles International Airport",
          city: "Los Angeles",
          country: "United States",
          lastUpdated: "2026-08-01",
        },
      ],
      lounges: [{ iata: "LAX", slug: "star-alliance-lounge", name: "Star Alliance Lounge" }],
    });
    assert.match(sitemap, /- \[Los Angeles International Airport \(LAX\)\]\(\/airports\/lax\.md\)/);
    assert.match(
      sitemap,
      / {2}- \[Lounge directory\]\(\/airports\/lax\/lounges\.md\)/,
    );
    assert.match(
      sitemap,
      / {2}- \[Getting there\]\(\/airports\/lax\/getting-there\.md\)/,
    );
    assert.match(
      sitemap,
      / {2}- \[Star Alliance Lounge\]\(\/airports\/lax\/lounge\/star-alliance-lounge\.md\)/,
    );
  });

  it("keeps YAML frontmatter first and trims guide-only airport .md to overview", () => {
    const markdown = buildAirportPageMarkdown({
      slug: "lax",
      profile: null,
      guide,
      googleRating: null,
      lounges: [lounge],
      reviews: [],
    });
    assert.ok(markdown);
    assert.ok(markdown!.startsWith("---\n"));
    assert.match(markdown!, /iata: LAX/);
    assert.match(markdown!, /\]\(\/airports\/lax\/lounges\.md\)/);
    assert.doesNotMatch(markdown!, /Best Airport Tricks/);
    assert.doesNotMatch(
      markdown!,
      /\]\(\/airports\/lax\/lounge\/star-alliance-lounge\.md\)/,
    );
  });

  it("builds a free lounge-directory .md and paid extra-tab .md", () => {
    const loungesMd = buildAirportTabMarkdown({
      slug: "lax",
      tab: "lounges",
      profile: null,
      guide,
      lounges: [lounge],
      reviews: [],
    });
    assert.ok(loungesMd);
    assert.match(loungesMd!, /Lounge directory/);
    assert.match(
      loungesMd!,
      /\]\(\/airports\/lax\/lounge\/star-alliance-lounge\.md\)/,
    );

    const tipsMd = buildAirportTabMarkdown({
      slug: "lax",
      tab: "tips",
      profile: null,
      guide,
      lounges: [],
      reviews: [],
    });
    assert.ok(tipsMd);
    assert.match(tipsMd!, /Traveler tips/);

    assert.equal(
      buildAirportTabMarkdown({
        slug: "lax",
        tab: "overview",
        profile: null,
        guide,
        lounges: [],
        reviews: [],
      }),
      null,
    );
  });

  it("renders lounge pages with relative airport links", () => {
    const markdown = buildLoungePageMarkdown({
      slug: "lax",
      loungeSlug: "star-alliance-lounge",
      lounge,
      airportName: "Los Angeles International Airport",
      otherLounges: [],
    });
    assert.match(markdown, /\]\(\/airports\/lax\.md\)/);
    assert.match(markdown, /# Star Alliance Lounge/);
  });

  it("returns null when an airport has neither profile nor guide", () => {
    assert.equal(
      buildAirportPageMarkdown({
        slug: "zzz",
        profile: null,
        guide: null,
        googleRating: null,
        lounges: [],
        reviews: [],
      }),
      null,
    );
  });

  it("includes Airportist Score when a profile is present", () => {
    const profile = {
      slug: "lax",
      iata: "LAX",
      icao: "KLAX",
      name: "Los Angeles International Airport",
      shortName: "LAX",
      city: "Los Angeles",
      country: "United States",
      region: "North America",
      coordinates: { latitude: 0, longitude: 0 },
      airportistScore: 7.5,
      scoreBreakdown: {
        comfort: 7,
        navigation: 7,
        food: 8,
        transport: 7,
        disruptionResilience: 8,
      },
      stats: {
        annualPassengers: "80M",
        terminals: "9",
        onTimePercentage: 75,
        averageSecurityMinutes: 25,
      },
      summary: "Sprawling hub.",
      bestFor: ["West Coast"],
      watchOutFor: ["Long walks"],
      amenities: [],
      tips: [],
      transport: [],
      disruption: {
        status: "normal",
        departureDelayMinutes: 0,
        departureDelayPercent: 0,
        arrivalDelayMinutes: 0,
        arrivalDelayPercent: 0,
        cancellationsPercent: 0,
        alerts: [],
        lastUpdated: new Date("2026-08-01"),
      },
      reviewCount: 0,
      guideLastUpdated: "2026-08-01",
    } satisfies Airport;

    const markdown = buildAirportPageMarkdown({
      slug: "lax",
      profile,
      guide: null,
      googleRating: null,
      lounges: [],
      reviews: [],
    });
    assert.ok(markdown);
    assert.match(markdown!, /Airportist Score/);
    assert.match(markdown!, /7\.5 \/ 10/);
    assert.match(markdown!, /\]\(\/airports\/lax\/lounges\.md\)/);
    assert.doesNotMatch(markdown!, /## Amenities/);
    assert.doesNotMatch(markdown!, /## Traveler tips/);
    assert.doesNotMatch(markdown!, /## Getting there/);
  });
});

describe("buildLlmsTxt", () => {
  it("advertises the authenticated MCP endpoint", () => {
    const text = buildLlmsTxt({
      scoredCount: 1,
      guideCount: 2,
      loungeCount: 3,
    });
    assert.match(text, /\/mcp/);
    assert.match(text, /Authorization: Bearer/);
    assert.match(text, /search_airports/);
    assert.match(text, /get_airport/);
    assert.match(text, /get_lounge/);
    assert.match(text, /lounge directory list are free/);
    assert.doesNotMatch(text, /`get_airport` and `get_lounge` may/);
  });
});
