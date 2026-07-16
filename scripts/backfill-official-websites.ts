#!/usr/bin/env tsx
/**
 * One-time backfill of `airport_guides.official_website` for guides written
 * before the column existed. No model calls: the research prompt has always
 * asked for the official airport site first in `sources`, so this picks the
 * first source whose host isn't a known community/aggregator/booking domain.
 *
 * Guides where every source is blocklisted are left NULL — the generator
 * cron fills those on their next refresh.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-official-websites.ts           # dry run (default)
 *   pnpm tsx scripts/backfill-official-websites.ts --apply   # write picks to the DB
 */

import { eq, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { airportGuides } from "../lib/db/schema";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

/**
 * Domains that can never be the airport operator's own site: encyclopedias,
 * forums, points blogs, lounge programs, OTAs/booking, airlines, aviation
 * databases, flight trackers, social media, and known official-lookalike
 * info sites. Matched as registrable-domain suffixes (never substrings —
 * `x.com` must not match `flylax.com`).
 */
const NON_OFFICIAL_DOMAINS = [
  // encyclopedias / wikis
  "wikipedia.org",
  "wikivoyage.org",
  "wikimedia.org",
  // forums & communities
  "reddit.com",
  "flyertalk.com",
  "vielfliegertreff.de",
  "tripadvisor.com",
  "quora.com",
  // points / travel blogs & lounge aggregators
  "prioritypass.com",
  "loungepair.com",
  "loungebuddy.com",
  "loungereview.com",
  "upgradedpoints.com",
  "thepointsguy.com",
  "onemileatatime.com",
  "headforpoints.com",
  "viewfromthewing.com",
  "godsavethepoints.com",
  "simpleflying.com",
  "nerdwallet.com",
  "flyctory.com",
  "happyfares.in",
  "thebestviewpoints.com",
  "nextflyapp.com",
  "sleepinginairports.net",
  // OTAs / booking / transit aggregators
  "trip.com",
  "booking.com",
  "expedia.com",
  "kayak.com",
  "skyscanner.net",
  "omio.com",
  "rome2rio.com",
  "seat61.com",
  "welcomepickups.com",
  "gettransfer.com",
  "viator.com",
  "getyourguide.com",
  "kupi.com",
  // airlines (they run lounges at airports, never the airport itself)
  "delta.com",
  "united.com",
  "aa.com",
  "qantas.com",
  "airtahiti.com",
  // aviation databases / regulators / flight trackers
  "airnav.com",
  "globalair.com",
  "faa.gov",
  "iowadot.gov",
  "flightconnections.com",
  "flightradar24.com",
  "flightaware.com",
  "flightstats.com",
  "transtats.bts.gov",
  "eurocontrol.int",
  // search / social / video
  "google.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  // official-lookalike info/transfer-selling sites
  "cancunairport.com",
  "cuninternationalairport.com",
  "flycunairport.com",
  "ortambo-airport.com",
];

/**
 * A picked URL whose path is about one specific topic (a lounge info sheet,
 * a wait-times page) is trimmed to the site root — the column stores the
 * airport's website, not its lounge page. Localized landing paths like
 * `/en/palma-de-mallorca.html` carry no topic keyword and are kept as-is.
 */
const TOPIC_PATH_KEYWORDS = [
  "lounge",
  "security",
  "wait-time",
  "parking",
  "transport",
  "info-sheet",
  "shopping",
  "dining",
  "terminal-map",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isOfficialCandidate(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !NON_OFFICIAL_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function trimTopicPath(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (TOPIC_PATH_KEYWORDS.some((keyword) => path.includes(keyword))) {
      return `${parsed.origin}/`;
    }
    return url;
  } catch {
    return url;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();

  const rows = await db
    .select({
      iata: airportGuides.iata,
      sources: airportGuides.sources,
    })
    .from(airportGuides)
    .where(isNull(airportGuides.officialWebsite))
    .orderBy(airportGuides.iata);

  console.log(`${rows.length} guides missing officialWebsite${apply ? "" : " (dry run)"}\n`);

  let picked = 0;
  let skipped = 0;

  for (const row of rows) {
    const index = row.sources.findIndex(isOfficialCandidate);
    const pick = index === -1 ? undefined : trimTopicPath(row.sources[index]);

    if (!pick) {
      skipped += 1;
      console.log(`SKIP ${row.iata}  no official candidate in ${row.sources.length} sources`);
      continue;
    }

    picked += 1;
    // Picks past position 0 break the "official site first" convention the
    // prompt asks for — worth a closer look in the dry run.
    const marker = index === 0 ? "  " : `⚠${index} `;
    console.log(`${marker}${row.iata}  ${pick}`);

    if (apply) {
      await db
        .update(airportGuides)
        .set({ officialWebsite: pick })
        .where(eq(airportGuides.iata, row.iata));
    }
  }

  console.log(
    `\n${apply ? "Wrote" : "Would write"} ${picked}, skipped ${skipped}.` +
      (apply ? "" : " Re-run with --apply to write."),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
