#!/usr/bin/env tsx
/**
 * Lounge directory enrichment powered by the local `pi` CLI (GPT 5.6 on the
 * ChatGPT subscription) — verifies and expands `airport_lounges` rows with
 * facts researched on the web: the Priority Pass lounge finder, the airport's
 * official lounge pages, airline lounge locators (Delta Sky Club, United
 * Club, Admirals Club, Lufthansa), card programs (Amex Centurion,
 * chase.com/sapphire-cards/lounges), and recent traveler reports.
 *
 * Rows are matched by their stable slug (the model echoes `existingSlug`,
 * with a deterministic name+terminal fallback), updated in place, and never
 * deleted — confirmed-closed lounges get `status: "closed"` so their URLs
 * keep resolving. `lastVerified` is stamped on every touched row; `--next`
 * re-verifies airports whose rows are unverified seeds first, then anything
 * older than the freshness window, majors first — so the directory converges
 * on verified data and then keeps itself fresh.
 *
 * Usage:
 *   pnpm sync:lounges LHR                 # one specific airport
 *   pnpm sync:lounges --next [--dry-run]  # next airport needing verification
 *   pnpm sync:lounges --next --limit 5    # process up to 5 in one run
 *
 * Designed for the VPS cron (flock-guarded, see sync-lounges-cron.sh).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fetchAirportGuideRow, fetchAllAirportGuideRows } from "../lib/airport-guides";
import {
  assignLoungeSlugs,
  fetchAirportLoungeRows,
  fetchAllAirportLoungeRows,
  loungeRecordSchema,
  LOUNGE_ACCESS_PROGRAMS,
  realGuideLounges,
  setAirportLoungeStatus,
  slugify,
  upsertAirportLounges,
  type AirportLoungeRecord,
} from "../lib/lounge-directory";
import { getMajorAirportCandidates } from "../lib/major-airports";
import { loadLocalEnv } from "./load-env";
import { extractJsonFromText, runPiHeadless } from "./pi-headless";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.sync-lounges.log");

/** Re-verify an airport's lounges when its stalest row is older than this. */
const FRESHNESS_DAYS = 180;

/** Big hubs mean many lounges and many fetches — give pi more headroom. */
const PI_TIMEOUT_MS = 45 * 60 * 1000;

// --- Model output schema --------------------------------------------------------

const researchedLoungeSchema = loungeRecordSchema.safeExtend({
  /** Slug of the existing row this lounge is, or null when genuinely new. */
  existingSlug: z.string().trim().min(1).nullish(),
});

const responseSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  sources: z.array(z.url()).min(1),
  /** Existing slugs the research confirmed permanently closed. */
  closedSlugs: z.array(z.string().trim().min(1)).default([]),
  lounges: z
    .array(researchedLoungeSchema)
    .max(25)
    .default([]),
});

// --- Prompt ---------------------------------------------------------------------

function buildLoungePrompt(
  iata: string,
  name: string,
  city: string,
  country: string,
  existing: Array<{ slug: string; name: string; terminal: string }>,
): string {
  const inventory =
    existing.length > 0
      ? JSON.stringify(existing, null, 2)
      : "[] (no lounges on record yet)";

  return `You are building the definitive, up-to-date lounge directory entry for ${name} (${iata}) in ${city}, ${country} for a traveler guide.

STEP 1 — RESEARCH with the web_search and fetch_content tools. Work through these sources in order and fetch the relevant pages:
1. Priority Pass lounge finder for ${iata} (prioritypass.com) — the canonical list of Priority Pass / LoungeKey lounges and their entry conditions.
2. The official ${name} website's lounge pages — full lounge list, terminals, hours, day-pass prices.
3. Airline & card program locators that operate at ${iata} (only the relevant ones): Delta Sky Club, United Club, Admirals Club, Lufthansa lounges, Amex Centurion (thecenturionlounge.com), chase.com/sapphire-cards/lounges, Plaza Premium, Aspire/Swissport.
4. Recent traveler reports (last 2 years): FlyerTalk, Reddit, LoungeReview, upgradedpoints — for honest verdicts, crowding, and closure news.

CURRENT DIRECTORY (lounges we already list for ${iata}):
${inventory}

STEP 2 — OUTPUT. Reply with ONLY a single JSON object (no markdown, no code fences, no commentary):

{
  "iata": "${iata}",
  "sources": ["https://... every URL you actually used"],
  "closedSlugs": ["existing slugs confirmed PERMANENTLY closed, [] if none"],
  "lounges": [
    {
      "existingSlug": "slug from the current directory if this is the same physical lounge (even under a slightly different name), else null",
      "name": "Official lounge name",
      "terminal": "Terminal 2",
      "zone": "airside | landside or concourse detail (optional)",
      "location": "Walkable directions, e.g. 'Mezzanine above Gate B12, escalator opposite Starbucks' (optional)",
      "access": [
        {
          "program": "one of: ${LOUNGE_ACCESS_PROGRAMS.join(" | ")}",
          "label": "REQUIRED when program is 'other' — name the program, e.g. 'Plaza Premium membership'",
          "details": "conditions, e.g. 'same-day Delta boarding pass, up to 2 guests' (optional)",
          "price": "for day-pass entries, e.g. '$59' (optional otherwise)"
        }
      ],
      "hours": "05:00-22:30 daily (optional)",
      "amenities": ["Showers", "Hot buffet", "Bar"],
      "foodAndDrinks": "One sentence on what's actually served (optional)",
      "showers": true,
      "bestFor": ["Long layovers"],
      "verdict": "worth-it | depends | skip (optional)",
      "summary": "One honest sentence — required.",
      "description": "2-3 short paragraphs for the lounge's own page: what it's like inside, how crowded it gets, whether it's worth queueing for. Separate paragraphs with blank lines.",
      "status": "open | temporarily-closed | closed",
      "sourceUrls": ["https://... URLs backing THIS lounge's facts"]
    }
  ]
}

Rules:
- Cover EVERY currently operating lounge at ${iata} that travelers can access, not just the ones already in the directory. Include closed ones only to flag them.
- Match against the current directory carefully: if a listed lounge is the same physical lounge, set its "existingSlug" — do not treat renames or slight name variants as new lounges.
- Only assert access programs, hours, and prices you found on pages you fetched; omit a field rather than guessing. Access rules change often — prefer what the program's own site says today.
- "access[].program" MUST be one of the listed values; use "other" plus a "label" for anything else (lounge-brand memberships etc.).
- Distinguish "temporarily-closed" (renovation, will reopen) from "closed" (gone for good; also add its slug to closedSlugs when it's an existing entry).
- Tone: direct, zero fluff, genuinely useful verdicts. All facts must come from pages you fetched, not memory alone.
- Do not create or modify any files. Your only deliverable is the JSON response.`;
}

// --- Matching --------------------------------------------------------------------

type ResearchedLounge = z.infer<typeof researchedLoungeSchema>;

function normalizedKey(name: string, terminal?: string): string {
  return terminal === undefined ? slugify(name) : `${slugify(name)}::${slugify(terminal)}`;
}

/**
 * Resolve which existing row each researched lounge is, in order of trust:
 * the model's `existingSlug` (validated), normalized name+terminal equality,
 * then normalized name alone when it's unambiguous. Unmatched lounges are new.
 */
function matchToExistingSlug(
  lounge: ResearchedLounge,
  existing: Array<{ slug: string; name: string; terminal: string }>,
  claimed: Set<string>,
): string | null {
  const available = existing.filter((row) => !claimed.has(row.slug));

  if (lounge.existingSlug && available.some((row) => row.slug === lounge.existingSlug)) {
    return lounge.existingSlug;
  }

  const byNameAndTerminal = available.filter(
    (row) =>
      normalizedKey(row.name, row.terminal) === normalizedKey(lounge.name, lounge.terminal),
  );
  if (byNameAndTerminal.length === 1) {
    return byNameAndTerminal[0].slug;
  }

  const byName = available.filter(
    (row) => normalizedKey(row.name) === normalizedKey(lounge.name),
  );
  if (byName.length === 1) {
    return byName[0].slug;
  }

  return null;
}

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function syncLounges(iata: string): Promise<void> {
  const normalizedIata = iata.toUpperCase();
  const startedAt = Date.now();

  const guide = await fetchAirportGuideRow(normalizedIata);
  if (!guide) {
    throw new Error(`No guide in Postgres for ${normalizedIata} — generate the guide first.`);
  }

  const existingRows = await fetchAirportLoungeRows(normalizedIata);
  const existing = existingRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    terminal: row.terminal,
  }));

  await logLine(
    `Researching lounges for ${normalizedIata} with pi (${existing.length} on record)…`,
  );

  const result = await runPiHeadless(
    buildLoungePrompt(normalizedIata, guide.name, guide.city, guide.country, existing),
    { timeoutMs: PI_TIMEOUT_MS },
  );

  const parsed = responseSchema.safeParse(extractJsonFromText(result.text ?? ""));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`pi output failed schema validation: ${detail}`);
  }
  if (parsed.data.iata !== normalizedIata) {
    throw new Error(`pi returned lounges for ${parsed.data.iata}, expected ${normalizedIata}`);
  }
  if (parsed.data.lounges.length === 0 && existing.length > 0) {
    throw new Error(
      `pi returned zero lounges for ${normalizedIata} despite ${existing.length} on record — refusing to stamp anything`,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const existingSlugSet = new Set(existing.map((row) => row.slug));
  const claimed = new Set<string>();
  const matched: AirportLoungeRecord[] = [];
  const unmatched: ResearchedLounge[] = [];

  // Two passes: honor the model's explicit existingSlug claims first, so
  // same-name lounges in one terminal (e.g. two Sky Clubs on a concourse)
  // leave the fallback matcher with unique candidates instead of ambiguity —
  // otherwise a rerun would mint duplicate rows for them.
  const [claiming, guessing] = parsed.data.lounges.reduce<
    [ResearchedLounge[], ResearchedLounge[]]
  >(
    (acc, lounge) => {
      acc[lounge.existingSlug && existingSlugSet.has(lounge.existingSlug) ? 0 : 1].push(lounge);
      return acc;
    },
    [[], []],
  );

  for (const lounge of [...claiming, ...guessing]) {
    const slug = matchToExistingSlug(lounge, existing, claimed);
    if (slug) {
      claimed.add(slug);
      matched.push({ ...lounge, slug, lastVerified: today });
    } else {
      unmatched.push(lounge);
    }
  }

  const created = assignLoungeSlugs(unmatched, existingSlugSet).map((lounge) => ({
    ...lounge,
    lastVerified: today,
  }));

  await upsertAirportLounges(normalizedIata, [...matched, ...created]);

  // Never delete: existing rows the research confirmed gone are flipped to
  // closed; rows the model simply didn't mention are left untouched.
  let closed = 0;
  for (const slug of parsed.data.closedSlugs) {
    if (existingSlugSet.has(slug) && !claimed.has(slug)) {
      await setAirportLoungeStatus(normalizedIata, slug, "closed");
      closed += 1;
    }
  }

  await requestSiteRevalidation();

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  await logLine(
    `✅ ${normalizedIata}: ${matched.length} lounges verified, ${created.length} new, ${closed} closed ` +
      `(${result.model ?? "unknown model"}, ${parsed.data.sources.length} sources, ${minutes} min)`,
  );
}

interface NextTarget {
  iata: string;
  reason: string;
}

/**
 * Airports needing lounge verification: guides with no verified rows first
 * (unseeded or seed-only), then airports whose stalest `lastVerified` is past
 * the freshness window. Majors (by traffic rank) first within each class.
 */
async function pickNextTargets(limit: number): Promise<NextTarget[]> {
  const [guideRows, loungeRows] = await Promise.all([
    fetchAllAirportGuideRows(),
    fetchAllAirportLoungeRows(),
  ]);

  // Oldest verification date per airport, ignoring unverified (null) rows —
  // a leftover seed row the research never matched must not re-trigger the
  // airport on every run; it gets another look at the next freshness cycle.
  const oldestVerified = new Map<string, string | null>();
  for (const row of loungeRows) {
    const iata = row.iata.toUpperCase();
    if (!oldestVerified.has(iata)) {
      oldestVerified.set(iata, row.lastVerified);
      continue;
    }
    const current = oldestVerified.get(iata) ?? null;
    if (row.lastVerified !== null && (current === null || row.lastVerified < current)) {
      oldestVerified.set(iata, row.lastVerified);
    }
  }

  const cutoff = new Date(Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const unverified = new Map<string, string>();
  const stale = new Map<string, string>();
  for (const guide of guideRows) {
    const iata = guide.iata.toUpperCase();
    const oldest = oldestVerified.get(iata);
    if (oldest === undefined) {
      // No directory rows. Only research airports whose guide knows of real
      // lounges — a lounge-less airport would return zero rows and be
      // re-picked forever. (Run the seed script to create rows first.)
      if (realGuideLounges(guide.lounges).length > 0) {
        unverified.set(iata, "no lounge rows yet");
      }
    } else if (oldest === null) {
      unverified.set(iata, "unverified seed rows");
    } else if (oldest < cutoff) {
      stale.set(iata, `stalest verification ${oldest} (older than ${FRESHNESS_DAYS}d)`);
    }
  }

  const majorRank = new Map(
    getMajorAirportCandidates().map((candidate) => [candidate.iata, candidate.rank]),
  );
  const byPriority = (a: string, b: string) =>
    (majorRank.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (majorRank.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b);

  const targets: NextTarget[] = [];
  for (const iata of [...unverified.keys()].sort(byPriority)) {
    if (targets.length >= limit) break;
    targets.push({ iata, reason: unverified.get(iata)! });
  }
  for (const iata of [...stale.keys()].sort(byPriority)) {
    if (targets.length >= limit) break;
    targets.push({ iata, reason: stale.get(iata)! });
  }

  return targets;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const useNext = args.includes("--next");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) : 1;
  const positional = args.filter(
    (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--limit",
  );

  if (useNext) {
    if (!Number.isInteger(limit) || limit < 1) {
      console.error("--limit expects a positive integer");
      process.exit(1);
    }

    const targets = await pickNextTargets(limit);
    if (targets.length === 0) {
      console.log("Every airport's lounges are verified and fresh. Nothing to do.");
      return;
    }
    if (dryRun) {
      for (const target of targets) {
        console.log(`Next up: ${target.iata} — ${target.reason}`);
      }
      return;
    }
    for (const target of targets) {
      await logLine(`--next picked ${target.iata}: ${target.reason}`);
      await syncLounges(target.iata);
    }
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm sync:lounges <IATA> | --next [--dry-run] [--limit N]");
    process.exit(1);
  }

  await syncLounges(iata);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(`❌ Failed: ${message}`);
  process.exit(1);
});
