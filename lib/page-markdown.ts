/**
 * Agent-readable markdown representations of public pages.
 *
 * Served from `/md/...` (rewritten from `*.md` URLs / `Accept: text/markdown`).
 * Intra-site links are root-relative so previews and local hosts stay correct.
 */
import matter from "gray-matter";
import {
  airportContentToMarkdown,
  type AirportContent,
  type AirportSummary,
  type AirportWaterOption,
} from "@/lib/airport-guides";
import {
  AIRPORT_TAB_VALUES,
  isAirportTabMarkdownSlug,
  isPaidAirportTab,
  type AirportTabMarkdownSlug,
} from "@/lib/airport-tabs";
import {
  PROGRAM_LABELS,
  type AirportLoungeView,
  type LoungeAccessMethod,
} from "@/lib/lounge-directory";
import type { AirportGoogleRating } from "@/lib/google-ratings";
import type { AirportUserReview } from "@/lib/review-schema";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Airport } from "@/lib/types";

export const MARKDOWN_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=86400";

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

/** Root-relative path helper for intra-site markdown links. */
export function mdHref(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function markdownResponse(
  body: string,
  init?: {
    status?: number;
    contentType?: string;
    cacheTags?: string[];
    canonicalPath?: string;
  },
): Response {
  const headers = new Headers({
    "Content-Type": init?.contentType ?? "text/markdown; charset=utf-8",
    Vary: "Accept",
    "Cache-Control": MARKDOWN_CACHE_CONTROL,
  });

  if (init?.cacheTags?.length) {
    // Vercel CDN / cache purge: keep in sync with `revalidateTag` names.
    headers.set("Cache-Tag", init.cacheTags.join(","));
  }

  if (init?.canonicalPath) {
    headers.set(
      "Link",
      `<${mdHref(init.canonicalPath)}>; rel="canonical", <${mdHref(init.canonicalPath)}>; rel="alternate"; type="text/markdown"`,
    );
  }

  return new Response(body, {
    status: init?.status ?? 200,
    headers,
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
    `- [Markdown sitemap](${mdHref("/sitemap.md")})`,
    `- [HTML home](${mdHref("/")})`,
    `- [llms.txt](${mdHref("/llms.txt")})`,
    "",
  ];

  if (scored.length > 0) {
    lines.push("## Scored airports", "");
    for (const airport of scored) {
      const slug = airport.slug || airport.iata.toLowerCase();
      lines.push(
        `- [${airport.shortName} (${airport.iata}) — ${airport.airportistScore.toFixed(1)}/10](${mdHref(`/airports/${slug}.md`)}) — ${airport.city}, ${airport.country}`,
      );
    }
    lines.push("");
  }

  const scoredIatas = new Set(scored.map((airport) => airport.iata.toUpperCase()));
  const unscoredGuides = guides.filter(
    (guide) => !scoredIatas.has(guide.iata.toUpperCase()),
  );
  if (unscoredGuides.length > 0) {
    lines.push("## Guide-only airports", "");
    for (const guide of unscoredGuides) {
      const slug = guide.iata.toLowerCase();
      lines.push(
        `- [${guide.name} (${guide.iata})](${mdHref(`/airports/${slug}.md`)}) — ${guide.city}, ${guide.country}`,
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
  const loungesByIata = new Map<string, Array<{ slug: string; name: string }>>();
  for (const lounge of lounges) {
    const iata = lounge.iata.toUpperCase();
    const bucket = loungesByIata.get(iata) ?? [];
    bucket.push({ slug: lounge.slug, name: lounge.name });
    loungesByIata.set(iata, bucket);
  }

  const airportSlugs = [
    ...new Set([
      ...scored.map((airport) => (airport.slug || airport.iata).toLowerCase()),
      ...guides.map((guide) => guide.iata.toLowerCase()),
      ...[...loungesByIata.keys()].map((iata) => iata.toLowerCase()),
    ]),
  ].sort();

  const lines: string[] = [
    `# ${SITE_NAME} sitemap`,
    "",
    `> ${AGENT_HINT}`,
    "",
    `- [Home](${mdHref("/index.md")})`,
    `- [llms.txt](${mdHref("/llms.txt")})`,
    "",
    "## Airports",
    "",
  ];

  for (const slug of airportSlugs) {
    const iata = slug.toUpperCase();
    const profile = scoredByIata.get(iata);
    const guide = guides.find((entry) => entry.iata.toUpperCase() === iata);
    const label = profile?.shortName ?? guide?.name ?? iata;
    const score = profile ? ` — ${profile.airportistScore.toFixed(1)}/10` : "";
    lines.push(
      `- [${label} (${iata})${score}](${mdHref(`/airports/${slug}.md`)})`,
    );
    lines.push(
      `  - [Lounge directory](${mdHref(`/airports/${slug}/lounges.md`)})`,
    );
    for (const tab of AIRPORT_TAB_VALUES) {
      if (tab === "overview" || tab === "lounges") continue;
      lines.push(
        `  - [${tabMarkdownLabel(tab)}](${mdHref(`/airports/${slug}/${tab}.md`)})`,
      );
    }

    const airportLounges = [...(loungesByIata.get(iata) ?? [])].sort((a, b) =>
      a.slug.localeCompare(b.slug),
    );
    for (const lounge of airportLounges) {
      lines.push(
        `  - [${lounge.name}](${mdHref(`/airports/${slug}/lounge/${lounge.slug}.md`)})`,
      );
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function tabMarkdownLabel(tab: AirportTabMarkdownSlug): string {
  switch (tab) {
    case "getting-there":
      return "Getting there";
    case "lounges":
      return "Lounge directory";
    case "amenities":
      return "Amenities";
    case "tips":
      return "Traveler tips";
    case "water":
      return "Water";
    case "guide":
      return "Full guide";
    case "disruptions":
      return "Disruptions";
    case "reviews":
      return "Reviews";
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

function moreIntelLinks(slug: string): string {
  const items = [
    `[Lounge directory](${mdHref(`/airports/${slug}/lounges.md`)}) (free)`,
    ...AIRPORT_TAB_VALUES.flatMap((tab) => {
      if (tab === "overview" || tab === "lounges") return [];
      const suffix = isPaidAirportTab(tab) ? "" : " (free)";
      return [
        `[${tabMarkdownLabel(tab)}](${mdHref(`/airports/${slug}/${tab}.md`)})${suffix}`,
      ];
    }),
  ];
  return section("More intel", bulletList(items));
}

function profileOverviewSections(
  airport: Airport,
  googleRating: AirportGoogleRating | null,
): string {
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

  return parts.filter(Boolean).join("\n").trim();
}

function amenitiesSection(airport: Airport): string {
  if (airport.amenities.length === 0) return "";
  return section(
    "Amenities",
    bulletList(
      airport.amenities.map(
        (amenity) =>
          `**${amenity.label}** (${amenity.quality}${amenity.isFeatured ? ", featured" : ""}): ${amenity.description}`,
      ),
    ),
  );
}

function tipsSection(airport: Airport): string {
  const tips = airport.importantTips?.length ? airport.importantTips : airport.tips;
  if (tips.length === 0) return "";
  return section(
    "Traveler tips",
    tips
      .map((tip) => {
        const detail = "detail" in tip && tip.detail ? `\n  ${tip.detail}` : "";
        const details = "details" in tip && tip.details ? `\n  ${tip.details}` : "";
        return `- **${tip.title}** (${tip.category}): ${tip.summary}${detail}${details}`;
      })
      .join("\n"),
  );
}

function gettingThereSection(airport: Airport): string {
  if (airport.transport.length === 0) return "";
  return section(
    "Getting there",
    airport.transport
      .map((option) => {
        const best = option.bestFor?.length
          ? ` Best for: ${option.bestFor.join(", ")}.`
          : "";
        return `- **${option.name}** (${option.type}): ${option.summary} ${option.timeToCity}, ${option.cost}.${best}${option.insiderTip ? ` Tip: ${option.insiderTip}` : ""}`;
      })
      .join("\n"),
  );
}

function waterSection(options: AirportWaterOption[] | undefined): string {
  if (!options?.length) return "";
  return section(
    "Water",
    bulletList(
      options.map((option) => {
        const flags = [
          option.isBestValue ? "best value" : null,
          option.isBestQuality ? "best quality" : null,
        ]
          .filter(Boolean)
          .join(", ");
        const meta = [option.kind, option.terminal, option.zone, option.price, flags]
          .filter(Boolean)
          .join(" · ");
        return `**${option.name}** (${meta}): ${option.location}. ${option.summary}`;
      }),
    ),
  );
}

function disruptionsSection(airport: Airport): string {
  const { disruption } = airport;
  return section(
    "Disruptions",
    bulletList([
      `Status: ${disruption.status}`,
      `Departure delay: ${disruption.departureDelayMinutes} min (${disruption.departureDelayPercent}%)`,
      `Arrival delay: ${disruption.arrivalDelayMinutes} min (${disruption.arrivalDelayPercent}%)`,
      `Cancellations: ${disruption.cancellationsPercent}%`,
      ...(disruption.alerts.length > 0
        ? disruption.alerts.map((alert) => `Alert: ${alert}`)
        : ["No active alerts"]),
    ]),
  );
}

function loungesSection(iata: string, lounges: AirportLoungeView[]): string {
  if (lounges.length === 0) return "";
  const slug = iata.toLowerCase();
  const items = lounges.map((lounge) => {
    const href = lounge.slug
      ? mdHref(`/airports/${slug}/lounge/${lounge.slug}.md`)
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

  const htmlPath = mdHref(`/airports/${slug}`);
  const header = [
    `> Markdown for [${htmlPath}](${htmlPath}). ${AGENT_HINT}`,
    "",
    `- [HTML page](${htmlPath})`,
    `- [Lounge directory](${mdHref(`/airports/${slug}/lounges.md`)})`,
    `- [Sitemap](${mdHref("/sitemap.md")})`,
    "",
  ].join("\n");

  if (guide && !profile) {
    // Overview-only: keep YAML frontmatter, drop the paid full-guide body.
    const { data } = matter(airportContentToMarkdown(guide));
    const facts = guide.frontmatter.quickFacts ?? [];
    const overview = [
      `# ${guide.frontmatter.name} (${guide.frontmatter.iata})`,
      "",
      `${guide.frontmatter.city}, ${guide.frontmatter.country}`,
      "",
      facts.length > 0 ? section("Quick facts", bulletList(facts)) : "",
      moreIntelLinks(slug),
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    return `${matter.stringify(`${header}${overview}\n`, data)}`;
  }

  if (profile && !guide) {
    const body = [
      profileOverviewSections(profile, googleRating),
      moreIntelLinks(slug),
    ]
      .filter(Boolean)
      .join("\n\n");
    return `${header}${body}\n`;
  }

  // Profile + guide: scored overview only. Paid tabs have their own `.md`.
  const guideDoc = airportContentToMarkdown(guide!);
  const { data: guideFrontmatter } = matter(guideDoc);
  const body = [
    header.trimEnd(),
    "",
    profileOverviewSections(profile!, googleRating),
    moreIntelLinks(slug),
  ]
    .filter(Boolean)
    .join("\n\n");

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

function tabPageHeader(slug: string, tab: string): string {
  const htmlPath = mdHref(`/airports/${slug}`);
  const tabPath = mdHref(`/airports/${slug}/${tab}.md`);
  return [
    `> Markdown for [${tabPath}](${tabPath}). ${AGENT_HINT}`,
    "",
    `- [Airport overview](${mdHref(`/airports/${slug}.md`)})`,
    `- [HTML page](${htmlPath})`,
    `- [Sitemap](${mdHref("/sitemap.md")})`,
    "",
  ].join("\n");
}

export function buildAirportTabMarkdown(input: {
  slug: string;
  tab: string;
  profile: Airport | null;
  guide: AirportContent | null;
  lounges: AirportLoungeView[];
  reviews: AirportUserReview[];
}): string | null {
  const { slug, tab, profile, guide, lounges, reviews } = input;
  if (!isAirportTabMarkdownSlug(tab)) {
    return null;
  }
  if (!profile && !guide && lounges.length === 0) {
    return null;
  }

  const iata = (profile?.iata ?? guide?.frontmatter.iata ?? slug).toUpperCase();
  const name = profile?.name ?? guide?.frontmatter.name ?? iata;
  const header = tabPageHeader(slug, tab);
  const title = `# ${name} (${iata}) — ${tabMarkdownLabel(tab)}`;

  let body = "";
  if (tab === "lounges") {
    body =
      loungesSection(iata, lounges) ||
      section("Lounges", "_No lounge directory yet._");
  } else {
    switch (tab) {
      case "getting-there":
        body = profile
          ? gettingThereSection(profile) ||
            section("Getting there", "_No ground-transport intel yet._")
          : section("Getting there", "_No ground-transport intel yet._");
        break;
      case "amenities":
        body = profile
          ? amenitiesSection(profile) ||
            section("Amenities", "_No amenity intel yet._")
          : section("Amenities", "_No amenity intel yet._");
        break;
      case "tips":
        body = profile
          ? tipsSection(profile) ||
            section("Traveler tips", "_No traveler tips yet._")
          : section("Traveler tips", "_No traveler tips yet._");
        break;
      case "water":
        body =
          waterSection(guide?.frontmatter.waterOptions) ||
          section("Water", "_No water-bottle intel yet._");
        break;
      case "guide":
        body = guide
          ? airportContentToMarkdown(guide).trim()
          : section("Full guide", "_No editorial guide yet._");
        break;
      case "disruptions":
        body = profile
          ? disruptionsSection(profile)
          : section("Disruptions", "_No disruption snapshot yet._");
        break;
      case "reviews":
        body =
          reviewsSection(reviews) || section("Reviews", "_No reviews yet._");
        break;
      default: {
        const exhaustive: never = tab;
        return exhaustive;
      }
    }
  }

  if (tab === "guide" && guide) {
    const { data } = matter(airportContentToMarkdown(guide));
    return `${matter.stringify(`${header}${body}\n`, data)}`;
  }

  return `${header}${title}\n\n${body}\n`;
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
  const htmlPath = mdHref(`/airports/${slug}/lounge/${loungeSlug}`);
  const airportMd = mdHref(`/airports/${slug}.md`);

  const facts = [
    `**Airport:** [${airportName} (${iata})](${airportMd})`,
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
    `> Markdown for [${htmlPath}](${htmlPath}). ${AGENT_HINT}`,
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
            const href = mdHref(`/airports/${slug}/lounge/${other.slug}.md`);
            return `[${other.name}](${href}) — ${other.terminal}`;
          }),
        ),
      ),
    );
  }

  parts.push(`- [Airport page](${airportMd})`, `- [HTML page](${htmlPath})`, "");
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

Prefer the \`.md\` URL (or follow \`rel="alternate" type="text/markdown"\`). Requests that send \`Accept: text/markdown\` on an HTML URL are redirected to the canonical \`.md\` path.

The site hosts ${input.scoredCount} scored airports, ${input.guideCount} guides, and ${input.loungeCount} lounge pages.

## Entry points

- HTML: ${SITE_URL}/
- Markdown home: ${SITE_URL}/index.md
- Markdown sitemap: ${SITE_URL}/sitemap.md
- This file: ${SITE_URL}/llms.txt
- Remote MCP: ${SITE_URL}/mcp

## MCP (machine tools)

Authenticated streamable-HTTP MCP server. Create a personal access token at ${SITE_URL}/settings and send \`Authorization: Bearer <token>\`. Unauthenticated requests receive HTTP 401.

Tools: \`search_airports\`, \`get_airport\`, \`list_lounges\`, \`get_lounge\`, \`list_major_airports\`.

If x402 is enabled, \`get_lounge\` may additionally return HTTP 402 + \`PAYMENT-REQUIRED\` after a valid token unless the account has a live Whop membership. \`get_airport\`, \`list_lounges\`, search, and list stay token-only. Airport overview, Getting There, and the lounge directory \`.md\` are free; individual lounge \`.md\` and other extra-tab docs may be paid.

## URL pattern

- Airport HTML: ${SITE_URL}/airports/{iata}
- Airport overview markdown (free): ${SITE_URL}/airports/{iata}.md
- Getting There markdown (free): ${SITE_URL}/airports/{iata}/getting-there.md
- Lounge directory markdown (free): ${SITE_URL}/airports/{iata}/lounges.md
- Paid tab markdown: ${SITE_URL}/airports/{iata}/{tab}.md
- Lounge HTML: ${SITE_URL}/airports/{iata}/lounge/{slug}
- Lounge markdown (paid): ${SITE_URL}/airports/{iata}/lounge/{slug}.md
`;
}
