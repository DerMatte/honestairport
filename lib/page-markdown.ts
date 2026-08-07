/**
 * Agent-readable markdown representations of public pages.
 *
 * Served from `/md/...` (and rewritten from `*.md` URLs / `Accept: text/markdown`).
 * Keeps the HTML pages untouched while giving agents a token-efficient copy of
 * the same content.
 */
import matter from "gray-matter";
import {
  airportContentToMarkdown,
  type AirportContent,
  type AirportSummary,
} from "@/lib/airport-guides";
import {
  PROGRAM_LABELS,
  type AirportLoungeView,
  type LoungeAccessMethod,
} from "@/lib/lounge-directory";
import type { AirportGoogleRating } from "@/lib/google-ratings";
import type { AirportUserReview } from "@/lib/review-schema";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Airport } from "@/lib/types";

const AGENT_HINT =
  "Append `.md` to any page URL (or send `Accept: text/markdown`) for an agent-readable copy.";

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function accessLabel(method: LoungeAccessMethod): string {
  const base =
    method.program === "other"
      ? (method.label ?? "Other")
      : PROGRAM_LABELS[method.program];
  const extras = [method.details, method.price].filter(Boolean).join(" · ");
  return extras ? `${base} (${extras})` : base;
}

function section(title: string, body: string | null | undefined): string {
  const trimmed = body?.trim();
  if (!trimmed) return "";
  return `## ${title}\n\n${trimmed}\n`;
}

export function markdownResponse(
  body: string,
  init?: { status?: number; contentType?: string },
): Response {
  return new Response(body, {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": init?.contentType ?? "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

export function buildHomeMarkdown(input: {
  scored: Airport[];
  guides: AirportSummary[];
}): string {
  const { scored, guides } = input;
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    "Honest airport reviews — Airportist Scores, disruption risk, and practical traveler advice.",
    "",
    `> ${AGENT_HINT}`,
    "",
    `- [Markdown sitemap](${SITE_URL}/sitemap.md)`,
    `- [HTML home](${SITE_URL}/)`,
    "",
  ];

  if (scored.length > 0) {
    lines.push("## Scored airports", "");
    for (const airport of scored) {
      const slug = airport.slug || airport.iata.toLowerCase();
      lines.push(
        `- [${airport.shortName} (${airport.iata}) — ${airport.airportistScore.toFixed(1)}/10](${SITE_URL}/airports/${slug}.md) — ${airport.city}, ${airport.country}`,
      );
    }
    lines.push("");
  }

  const unscoredGuides = guides.filter(
    (guide) => !scored.some((airport) => airport.iata.toUpperCase() === guide.iata.toUpperCase()),
  );
  if (unscoredGuides.length > 0) {
    lines.push("## Guide-only airports", "");
    for (const guide of unscoredGuides) {
      const slug = guide.iata.toLowerCase();
      lines.push(
        `- [${guide.name} (${guide.iata})](${SITE_URL}/airports/${slug}.md) — ${guide.city}, ${guide.country}`,
      );
    }
    lines.push("");
  }

  if (scored.length === 0 && guides.length === 0) {
    lines.push("_No airport guides or scores are available yet._", "");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function buildSitemapMarkdown(input: {
  scored: Airport[];
  guides: AirportSummary[];
  lounges: Array<{ iata: string; slug: string; name: string }>;
}): string {
  const { scored, guides, lounges } = input;
  const scoredByIata = new Map(
    scored.map((airport) => [airport.iata.toUpperCase(), airport]),
  );
  const airportSlugs = [
    ...new Set([
      ...scored.map((airport) => (airport.slug || airport.iata).toLowerCase()),
      ...guides.map((guide) => guide.iata.toLowerCase()),
    ]),
  ].sort();

  const lines: string[] = [
    `# ${SITE_NAME} sitemap`,
    "",
    `> ${AGENT_HINT}`,
    "",
    `- [Home](${SITE_URL}/index.md)`,
    "",
    "## Airports",
    "",
  ];

  for (const slug of airportSlugs) {
    const iata = slug.toUpperCase();
    const profile = scoredByIata.get(iata);
    const guide = guides.find((entry) => entry.iata.toUpperCase() === iata);
    const label =
      profile?.shortName ??
      guide?.name ??
      iata;
    const score = profile ? ` — ${profile.airportistScore.toFixed(1)}/10` : "";
    lines.push(`- [${label} (${iata})${score}](${SITE_URL}/airports/${slug}.md)`);
  }

  if (lounges.length > 0) {
    lines.push("", "## Lounges", "");
    const sorted = [...lounges].sort(
      (a, b) => a.iata.localeCompare(b.iata) || a.slug.localeCompare(b.slug),
    );
    for (const lounge of sorted) {
      const iata = lounge.iata.toUpperCase();
      const slug = iata.toLowerCase();
      lines.push(
        `- [${lounge.name} at ${iata}](${SITE_URL}/airports/${slug}/lounge/${lounge.slug}.md)`,
      );
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function profileSections(airport: Airport, googleRating: AirportGoogleRating | null): string {
  const breakdown = airport.scoreBreakdown;
  const parts: string[] = [
    `# ${airport.name} (${airport.iata})`,
    "",
    `${airport.city}, ${airport.country} · ${airport.region}`,
    "",
    airport.summary,
    "",
    section(
      "Airportist Score",
      [
        `**${airport.airportistScore.toFixed(1)} / 10**`,
        "",
        bulletList([
          `Comfort: ${breakdown.comfort.toFixed(1)}`,
          `Navigation: ${breakdown.navigation.toFixed(1)}`,
          `Food: ${breakdown.food.toFixed(1)}`,
          `Transport: ${breakdown.transport.toFixed(1)}`,
          `Disruption resilience: ${breakdown.disruptionResilience.toFixed(1)}`,
        ]),
        googleRating
          ? `\nGoogle rating: ${googleRating.rating.toFixed(1)} (${googleRating.reviewCount.toLocaleString()} reviews)`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    section(
      "At a glance",
      bulletList([
        `Passengers: ${airport.stats.annualPassengers}`,
        `Terminals: ${airport.stats.terminals}`,
        `Typical security: ${airport.stats.averageSecurityMinutes} min`,
        `On-time: ${airport.stats.onTimePercentage}%`,
        `Disruption: ${airport.disruption.status}`,
      ]),
    ),
  ];

  if (airport.bestFor.length > 0) {
    parts.push(section("Best for", bulletList(airport.bestFor)));
  }
  if (airport.watchOutFor.length > 0) {
    parts.push(section("Watch out for", bulletList(airport.watchOutFor)));
  }

  if (airport.amenities.length > 0) {
    parts.push(
      section(
        "Amenities",
        bulletList(
          airport.amenities.map(
            (amenity) =>
              `**${amenity.label}** (${amenity.quality}${amenity.isFeatured ? ", featured" : ""}): ${amenity.description}`,
          ),
        ),
      ),
    );
  }

  const tips = airport.importantTips?.length ? airport.importantTips : airport.tips;
  if (tips.length > 0) {
    parts.push(
      section(
        "Traveler tips",
        tips
          .map((tip) => {
            const detail = "detail" in tip && tip.detail ? `\n  ${tip.detail}` : "";
            const details = "details" in tip && tip.details ? `\n  ${tip.details}` : "";
            return `- **${tip.title}** (${tip.category}): ${tip.summary}${detail}${details}`;
          })
          .join("\n"),
      ),
    );
  }

  if (airport.transport.length > 0) {
    parts.push(
      section(
        "Getting there",
        airport.transport
          .map((option) => {
            const best = option.bestFor?.length
              ? ` Best for: ${option.bestFor.join(", ")}.`
              : "";
            return `- **${option.name}** (${option.type}): ${option.summary} ${option.timeToCity}, ${option.cost}.${best}${option.insiderTip ? ` Tip: ${option.insiderTip}` : ""}`;
          })
          .join("\n"),
      ),
    );
  }

  return parts.filter(Boolean).join("\n").trim();
}

function loungesSection(iata: string, lounges: AirportLoungeView[]): string {
  if (lounges.length === 0) return "";
  const slug = iata.toLowerCase();
  const items = lounges.map((lounge) => {
    const href = lounge.slug
      ? `${SITE_URL}/airports/${slug}/lounge/${lounge.slug}.md`
      : null;
    const label = href ? `[${lounge.name}](${href})` : lounge.name;
    const meta = [lounge.terminal, lounge.verdict, lounge.status]
      .filter(Boolean)
      .join(" · ");
    return `- ${label}${meta ? ` — ${meta}` : ""}: ${lounge.summary}`;
  });
  return section("Lounges", items.join("\n"));
}

function reviewsSection(reviews: AirportUserReview[]): string {
  if (reviews.length === 0) return "";
  return section(
    "Reviews",
    reviews
      .map(
        (review) =>
          `- **${review.title}** (${review.rating}/5, ${review.author}, ${review.createdAt.slice(0, 10)}): ${review.body}`,
      )
      .join("\n"),
  );
}

function injectAfterFrontmatter(markdown: string, preface: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) {
    return `${preface}${markdown}`;
  }
  const body = markdown.slice(match[0].length).replace(/^\r?\n*/, "");
  return `${match[0]}\n${preface}${body}`;
}

export function buildAirportPageMarkdown(input: {
  slug: string;
  profile: Airport | null;
  guide: AirportContent | null;
  googleRating: AirportGoogleRating | null;
  lounges: AirportLoungeView[];
  reviews: AirportUserReview[];
}): string | null {
  const { slug, profile, guide, googleRating, lounges, reviews } = input;
  if (!profile && !guide) {
    return null;
  }

  const htmlUrl = `${SITE_URL}/airports/${slug}`;
  const header = [
    `> Markdown for [${htmlUrl}](${htmlUrl}). ${AGENT_HINT}`,
    "",
    `- [HTML page](${htmlUrl})`,
    `- [Sitemap](${SITE_URL}/sitemap.md)`,
    "",
  ].join("\n");

  if (guide && !profile) {
    // Guide-only pages: serve the stored markdown document as-is (agents already
    // know this shape from the content pipeline), with a short discovery header
    // after frontmatter so YAML parsers still work.
    const guideMarkdown = airportContentToMarkdown(guide).trim();
    const extras = [loungesSection(guide.frontmatter.iata, lounges), reviewsSection(reviews)]
      .filter(Boolean)
      .join("\n");
    const withHeader = injectAfterFrontmatter(guideMarkdown, header);
    return `${withHeader}${extras ? `\n\n${extras}` : ""}\n`;
  }

  if (profile && !guide) {
    const body = [
      profileSections(profile, googleRating),
      loungesSection(profile.iata, lounges),
      reviewsSection(reviews),
    ]
      .filter(Boolean)
      .join("\n\n");
    return `${header}${body}\n`;
  }

  // Profile + guide: scored overview first, then the full guide document.
  const guideDoc = airportContentToMarkdown(guide!);
  const { content: guideBody, data: guideFrontmatter } = matter(guideDoc);
  const body = [
    header.trimEnd(),
    "",
    profileSections(profile!, googleRating),
    loungesSection(profile!.iata, lounges),
    reviewsSection(reviews),
    "## Traveler guide",
    "",
    guideBody.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Keep guide frontmatter so agents retain structured metadata.
  const data = Object.fromEntries(
    Object.entries({
      ...(guideFrontmatter as Record<string, unknown>),
      airportistScore: profile!.airportistScore,
      slug: profile!.slug,
      region: profile!.region,
    }).filter(([, value]) => value !== undefined),
  );

  return `${matter.stringify(`${body}\n`, data)}`;
}

export function buildLoungePageMarkdown(input: {
  slug: string;
  loungeSlug: string;
  lounge: AirportLoungeView;
  airportName: string;
  otherLounges: AirportLoungeView[];
}): string {
  const { slug, loungeSlug, lounge, airportName, otherLounges } = input;
  const iata = slug.toUpperCase();
  const htmlUrl = `${SITE_URL}/airports/${slug}/lounge/${loungeSlug}`;
  const airportUrl = `${SITE_URL}/airports/${slug}.md`;

  const facts = [
    `**Airport:** [${airportName} (${iata})](${airportUrl})`,
    `**Status:** ${lounge.status}`,
    `**Terminal:** ${lounge.terminal}`,
    lounge.zone ? `**Zone:** ${lounge.zone}` : null,
    lounge.location ? `**Location:** ${lounge.location}` : null,
    lounge.hours ? `**Hours:** ${lounge.hours}` : null,
    lounge.verdict ? `**Verdict:** ${lounge.verdict}` : null,
    lounge.showers != null ? `**Showers:** ${lounge.showers ? "Yes" : "No"}` : null,
    lounge.lastVerified ? `**Last verified:** ${lounge.lastVerified}` : null,
  ].filter(Boolean) as string[];

  const parts: string[] = [
    `> Markdown for [${htmlUrl}](${htmlUrl}). ${AGENT_HINT}`,
    "",
    `# ${lounge.name}`,
    "",
    `${airportName} (${iata}) lounge`,
    "",
    lounge.summary,
    "",
    section("Facts", facts.join("\n")),
  ];

  if (lounge.access.length > 0) {
    parts.push(
      section("Access", bulletList(lounge.access.map((method) => accessLabel(method)))),
    );
  }
  if (lounge.amenities.length > 0) {
    parts.push(section("Amenities", bulletList(lounge.amenities)));
  }
  if (lounge.bestFor.length > 0) {
    parts.push(section("Best for", bulletList(lounge.bestFor)));
  }
  if (lounge.foodAndDrinks) {
    parts.push(section("Food and drinks", lounge.foodAndDrinks));
  }
  if (lounge.description) {
    parts.push(section("Details", lounge.description.trim()));
  }
  if (lounge.sourceUrls.length > 0) {
    parts.push(
      section(
        "Sources",
        bulletList(lounge.sourceUrls.map((url) => `[${url}](${url})`)),
      ),
    );
  }

  const others = otherLounges.filter((other) => other.slug && other.slug !== lounge.slug);
  if (others.length > 0) {
    parts.push(
      section(
        "Other lounges at this airport",
        bulletList(
          others.map((other) => {
            const href = `${SITE_URL}/airports/${slug}/lounge/${other.slug}.md`;
            return `[${other.name}](${href}) — ${other.terminal}`;
          }),
        ),
      ),
    );
  }

  parts.push(`- [Airport page](${airportUrl})`, `- [HTML page](${htmlUrl})`, "");
  return `${parts.filter(Boolean).join("\n").trim()}\n`;
}

export function buildLlmsTxt(input: {
  scoredCount: number;
  guideCount: number;
  loungeCount: number;
}): string {
  return `# ${SITE_NAME}

> Traveler-focused airport directory with Airportist Scores, guides, lounges, and tips.

${AGENT_HINT}

The site hosts ${input.scoredCount} scored airports, ${input.guideCount} guides, and ${input.loungeCount} lounge pages.

## Entry points

- HTML: ${SITE_URL}/
- Markdown home: ${SITE_URL}/index.md
- Markdown sitemap: ${SITE_URL}/sitemap.md

## URL pattern

- Airport HTML: ${SITE_URL}/airports/{iata}
- Airport markdown: ${SITE_URL}/airports/{iata}.md
- Lounge HTML: ${SITE_URL}/airports/{iata}/lounge/{slug}
- Lounge markdown: ${SITE_URL}/airports/{iata}/lounge/{slug}.md
`;
}
