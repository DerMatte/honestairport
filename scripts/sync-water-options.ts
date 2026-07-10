#!/usr/bin/env tsx
/**
 * Water-options backfill powered by the local `pi` CLI (GPT 5.6 on the
 * ChatGPT subscription) — counterpart to the grok guide generator for the
 * one field existing guides predate: `waterOptions` (the Water tab).
 *
 * The grok cron rewrites whole guides and fills waterOptions as it goes, but
 * at one airport per half hour a full catalog pass takes months. This script
 * researches ONLY water (cheapest bottle, refill stations, free options) for
 * a guide that has none, then updates that guide's `waterOptions` frontmatter
 * and its `## Water & Hydration` markdown section in place — everything else,
 * including `lastUpdated`, is left untouched so the grok cron's stalest-first
 * refresh ordering is not distorted.
 *
 * Usage:
 *   pnpm sync:water LHR                 # one specific airport
 *   pnpm sync:water --next [--dry-run]  # next guide missing water options
 *   pnpm sync:water --next --limit 5    # process up to 5 in one run
 *
 * Designed for the VPS cron (flock-guarded, see sync-water-options-cron.sh);
 * exits immediately once every guide has water options.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  fetchAirportGuideRow,
  fetchAllAirportGuideRows,
  rowToAirportContent,
  upsertAirportGuide,
  type AirportWaterOption,
} from "../lib/airport-guides";
import { boundedArray, nonEmpty, optionalNonEmpty } from "../lib/airport-profile-schema";
import { getMajorAirportCandidates } from "../lib/major-airports";
import { loadLocalEnv } from "./load-env";
import { extractJsonFromText, runPiHeadless } from "./pi-headless";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.sync-water-options.log");

// --- Model output schema --------------------------------------------------------
//
// Same shape and tolerance philosophy as the grok generator's waterOptions
// (blank optional strings become undefined, over-long lists truncate), so
// both pipelines agree on what a valid option is.

const waterOptionSchema = z
  .object({
    kind: z.enum(["purchase", "refill", "free"]),
    name: nonEmpty,
    terminal: nonEmpty,
    location: nonEmpty.min(
      12,
      "must name a walkable landmark (e.g. next to Heinemann, opposite McDonald's)",
    ),
    zone: z.enum(["airside", "landside"]).optional(),
    price: optionalNonEmpty,
    summary: nonEmpty,
    isBestValue: z.boolean().optional(),
    isBestQuality: z.boolean().optional(),
  })
  .superRefine((option, ctx) => {
    if (option.kind === "purchase" && !option.price) {
      ctx.addIssue({
        code: "custom",
        message: "purchase options must include a price",
        path: ["price"],
      });
    }

    if (option.location.trim().toLowerCase() === option.terminal.trim().toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        message: "location must be more specific than the terminal name alone",
        path: ["location"],
      });
    }
  });

const responseSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  sources: z.array(z.url()).min(1),
  waterOptions: boundedArray(waterOptionSchema, 2, 6).superRefine((options, ctx) => {
    const bestValueCount = options.filter((option) => option.isBestValue).length;
    const bestQualityCount = options.filter((option) => option.isBestQuality).length;

    if (bestValueCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "exactly one water option must set isBestValue: true",
      });
    }

    if (bestQualityCount > 1) {
      ctx.addIssue({
        code: "custom",
        message: "at most one water option may set isBestQuality: true",
      });
    }
  }),
});

// --- Prompt ---------------------------------------------------------------------

function buildWaterPrompt(iata: string, name: string, city: string, country: string): string {
  return `You are researching drinking-water options at ${name} (${iata}) in ${city}, ${country} for a traveler guide.

STEP 1 — RESEARCH with the web_search and fetch_content tools:
- Search for e.g. "${iata} airport water refill station", "${iata} airport water bottle price", "${iata} airport water fountain", plus FlyerTalk/Reddit threads on the topic.
- Fetch the official airport website's pages on water fountains / refill stations / food & shops, and the most promising forum threads, and read them. Prefer sources from the last 2 years.
Only state locations and prices you actually found; omit a field rather than guessing. If research only supports 2 solid options, return 2 — never pad with invented ones.

STEP 2 — OUTPUT. Reply with ONLY a single JSON object (no markdown, no code fences, no commentary):

{
  "iata": "${iata}",
  "sources": ["https://... every URL you actually used"],
  "waterOptions": [
    {
      "kind": "purchase | refill | free",
      "name": "Vendor or fountain name",
      "terminal": "Terminal 2",
      "location": "Required — specific walkable reference, e.g. 'Next to Heinemann duty-free, departures hall' or 'Opposite McDonald's, airside near Gate B12'",
      "zone": "airside | landside (optional)",
      "price": "Required for purchase options, e.g. €1.80 for 500ml",
      "summary": "One honest sentence on why this is the cheapest bottle, best refill spot, or free option.",
      "isBestValue": true,
      "isBestQuality": false
    }
  ]
}

Rules:
- 2-6 waterOptions covering the cheapest bottle purchase, at least one refill or free option, with exactly one isBestValue and at most one isBestQuality.
- "terminal" is REQUIRED on every option. At single-terminal airports use the terminal's official name (e.g. "Domestic Terminal" at ATL) and put the concourse/gate detail in "location".
- Every option must include a specific "location" anchored to a nearby shop, gate cluster, or landmark — never the terminal name alone (e.g. "Next to WHSmith opposite Gate 12", "Refill fountain beside the Starbucks in Pier C").
- Include real prices for purchase options when you find them.
- Tone: direct, zero fluff. All facts must come from pages you fetched, not memory alone.
- Do not create or modify any files. Your only deliverable is the JSON response.`;
}

// --- Markdown section upsert ------------------------------------------------------

function buildWaterSection(options: AirportWaterOption[]): string {
  const lines = options.map((option) => {
    const zone = option.zone ? ` (${option.zone})` : "";
    const price = option.price ? ` — ${option.price}` : "";
    return `- ${option.name}, ${option.terminal}${zone} — ${option.location}${price}: ${option.summary}`;
  });

  return `## Water & Hydration\n${lines.join("\n")}`;
}

/**
 * Replace the guide's water section, or insert one where the grok generator
 * would put it (before ground transport, falling back to before the sources,
 * then the end of the document).
 */
export function upsertWaterSection(content: string, section: string): string {
  const waterHeading = /^##\s+(?:Water\s*&\s*Hydration|Water Bottles\s*&\s*Refills)\s*$/im;
  const existing = content.match(waterHeading);

  if (existing?.index !== undefined) {
    const bodyStart = existing.index + existing[0].length;
    const nextHeading = content.slice(bodyStart).search(/^##\s+/m);
    const end = nextHeading === -1 ? content.length : bodyStart + nextHeading;
    return `${content.slice(0, existing.index)}${section}\n\n${content.slice(end).replace(/^\n+/, "")}`.trimEnd();
  }

  const anchors = [
    /^##\s+Ground Transport & Parking\s*$/im,
    /^##\s+Getting There & Away\s*$/im,
    /^##\s+Official Sources\s*$/im,
  ];
  for (const anchor of anchors) {
    const match = content.match(anchor);
    if (match?.index !== undefined) {
      return `${content.slice(0, match.index)}${section}\n\n${content.slice(match.index)}`;
    }
  }

  return `${content.trimEnd()}\n\n${section}`;
}

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function syncWaterOptions(iata: string): Promise<void> {
  const normalizedIata = iata.toUpperCase();
  const startedAt = Date.now();

  const row = await fetchAirportGuideRow(normalizedIata);
  if (!row) {
    throw new Error(`No guide in Postgres for ${normalizedIata} — generate the guide first.`);
  }

  await logLine(`Researching water options for ${normalizedIata} with pi…`);

  const result = await runPiHeadless(
    buildWaterPrompt(normalizedIata, row.name, row.city, row.country),
  );

  const parsed = responseSchema.safeParse(extractJsonFromText(result.text ?? ""));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`pi output failed schema validation: ${detail}`);
  }
  if (parsed.data.iata !== normalizedIata) {
    throw new Error(`pi returned options for ${parsed.data.iata}, expected ${normalizedIata}`);
  }

  const content = rowToAirportContent(row);
  content.frontmatter.waterOptions = parsed.data.waterOptions;
  content.content = upsertWaterSection(
    content.content,
    buildWaterSection(parsed.data.waterOptions),
  );

  await upsertAirportGuide(content);
  await requestSiteRevalidation();

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  await logLine(
    `✅ ${normalizedIata}: ${parsed.data.waterOptions.length} water options written ` +
      `(${result.model ?? "unknown model"}, ${parsed.data.sources.length} sources, ${minutes} min)`,
  );
}

interface NextTarget {
  iata: string;
  reason: string;
}

/**
 * Guides missing water options, majors (by traffic rank) first, then the
 * stalest remaining guides — same spirit as the grok cron's --next.
 */
async function pickNextTargets(limit: number): Promise<NextTarget[]> {
  const guideRows = await fetchAllAirportGuideRows();
  const missing = new Map(
    guideRows
      .filter((row) => row.waterOptions.length === 0)
      .map((row) => [row.iata.toUpperCase(), row]),
  );

  const targets: NextTarget[] = [];

  for (const candidate of getMajorAirportCandidates()) {
    if (targets.length >= limit) break;
    if (missing.has(candidate.iata)) {
      missing.delete(candidate.iata);
      targets.push({
        iata: candidate.iata,
        reason: `major airport #${candidate.rank} (${candidate.name}) missing water options`,
      });
    }
  }

  const rest = [...missing.values()].sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));
  for (const row of rest) {
    if (targets.length >= limit) break;
    targets.push({
      iata: row.iata.toUpperCase(),
      reason: `guide missing water options (lastUpdated ${row.lastUpdated})`,
    });
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
      console.log("Every guide has water options. Nothing to do.");
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
      await syncWaterOptions(target.iata);
    }
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm sync:water <IATA> | --next [--dry-run] [--limit N]");
    process.exit(1);
  }

  await syncWaterOptions(iata);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(`❌ Failed: ${message}`);
  process.exit(1);
});
