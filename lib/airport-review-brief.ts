import {
  formatForumActivityForPrompt,
  type CommunityForumThreadActivity,
} from "./community-forum";

export const COMMUNITY_FORUM_URL =
  "https://www.vielfliegertreff.de/forum/forums/airports-lounges.12/";

/**
 * Editorial style inspired by frequent-flyer community forums:
 * practical, community-tested tips — not marketing copy.
 */
export const AIRPORT_REVIEW_STYLE = `
## Voice and bar for updates

Write like an experienced frequent flyer sharing hard-won airport knowledge:
- Direct, slightly opinionated, zero fluff
- Specific enough to act on ("Terminal 5 upper level near Gate A", not "some areas")
- Call out what is overrated vs. actually worth it (lounges, food, transport)
- Note when advice depends on status, alliance, time of day, or terminal
- Flag stale or uncertain claims instead of guessing

## Topics frequent-flyer communities care about (prioritize gaps)

1. **Minimum connection times (MCT)** — realistic airside transfer times, terminal changes, immigration quirks
2. **Airport ↔ city transport** — fastest, cheapest, and insider timing (rush hour, night arrivals)
3. **Security & fast track** — alliance fast track, paid lanes, peak windows, liquids rules
4. **Lounges** — access rules, which lounges are worth paying for, overcrowding patterns
5. **Infrastructure & navigation** — terminal layout, common wrong turns, construction impacts
6. **Wi‑Fi & power** — login quirks, time limits, best charging/seating spots
7. **Water & basics** — refill stations, bottle prices, and landmark-relative locations (e.g. next to Heinemann, opposite McDonald's) airside/landside
8. **Food & amenities** — standout options vs. traps; order-ahead hacks where relevant
9. **News & changes** — recent terminal openings, rule changes, strike/disruption patterns (only if verified)

## Where guides live and how to edit them

Guides are stored in Postgres (DATABASE_URL is available in the environment), not as repo files. Use the guide CLI:
- \`pnpm guide list\` — all guides with IATA and lastUpdated
- \`pnpm guide show LHR /tmp/lhr.md\` — export a guide as markdown (frontmatter + body) to a file
- \`pnpm guide save /tmp/lhr.md\` — validate, write back to the database, and refresh the live site

Edit the exported markdown file, then save it. Saves are rejected if frontmatter or the required sections are invalid, and every save keeps a revision snapshot for rollback.

## Page structure to preserve

Each guide must keep:
- YAML frontmatter: iata, name, city, country, lastUpdated, sources, quickFacts
- Body headings (in order): Quick Facts, Security & Screening Tips, Best Airport Tricks & Hacks,
  Terminals & Navigation, Lounges Food & Amenities, Ground Transport & Parking, Official Sources

## Fact-checking rules

- Prefer official airport, airline alliance, and transport authority sources
- Update \`lastUpdated\` when material facts change
- Add new URLs to frontmatter \`sources\` when you rely on them
- Remove or rewrite placeholder "(Coming soon...)" sections with real content when possible
- Do not invent prices, wait times, or lounge access rules — verify or mark as "check before travel"
`.trim();

export interface AirportReviewForumContext {
  airportThreads?: CommunityForumThreadActivity[];
  referenceThreads?: CommunityForumThreadActivity[];
}

export function buildAirportReviewPrompt(options?: {
  iata?: string;
  openPr?: boolean;
  forumContext?: AirportReviewForumContext;
}): string {
  const scope = options?.iata
    ? `Focus this run on **${options.iata.toUpperCase()}** (\`pnpm guide show ${options.iata.toUpperCase()}\`). Still skim other guides only if you spot cross-airport inconsistencies.`
    : "Review **every** guide (`pnpm guide list`), starting with the oldest `lastUpdated`.";

  const output = options?.openPr
    ? "Open a pull request with a clear summary of what changed and why."
    : "Save each improved guide back to the database with `pnpm guide save`. Do not commit repo files.";

  const forumSection = buildForumContextSection(options?.forumContext);

  return `
You maintain TravelGuide — one scannable Markdown page per airport with practical traveler tips.

Community forum for airport tips (German frequent-flyer board): ${COMMUNITY_FORUM_URL}

${AIRPORT_REVIEW_STYLE}
${forumSection}

## Your task this run

${scope}

For each page:
1. Export the guide (\`pnpm guide show <IATA> /tmp/<iata>.md\`) and compare it to the style bar above.
2. Research recent, reputable updates (official airport site, transport operators, alliance pages).
3. When forum activity is listed below, read those threads and fold in verified or well-supported traveler tips.
4. Expand thin or placeholder sections with practical frequent-flyer detail.
5. Fix outdated facts; tighten wording; add "works best when / avoid if" context to hacks.
6. Refresh \`lastUpdated\` and \`sources\` in frontmatter when you change material facts.
7. Keep the existing heading structure — do not rename sections.

## Quality gate

- Only add information you can tie to a source or clearly label as traveler consensus ("many FF reports…").
- Prefer fewer, sharper bullets over long generic lists.
- If a page is already strong, make small high-value additions rather than rewriting for its own sake.
- Forum posts are often in German — synthesize in English; add thread URLs to \`sources\` when used.

## Output

${output}

When done, list:
- Airports touched
- Top 3 highest-value additions per airport
- Anything you could not verify and left unchanged
`.trim();
}

function buildForumContextSection(forumContext?: AirportReviewForumContext): string {
  if (!forumContext) return "";

  const airportThreads = forumContext.airportThreads ?? [];
  const referenceThreads = forumContext.referenceThreads ?? [];

  if (airportThreads.length === 0 && referenceThreads.length === 0) {
    return "";
  }

  return `

## New community forum activity (since last sync)

${formatForumActivityForPrompt(airportThreads, referenceThreads)}

Read the linked threads for details beyond the snippets. Cross-check tips against official sources before adding them.
`.trim();
}
