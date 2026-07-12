#!/usr/bin/env tsx
/**
 * Batch rebuild of airport pages through the Vercel AI Gateway running
 * xai/grok-4.5 with Live Search, so every page is actually researched (not
 * written from model memory). Each airport gets the same combined output as
 * the grok-CLI cron: the markdown guide (`airport_guides`) plus the
 * Airportist Score profile (`airport_profiles`) — prompt, schema, and
 * converters shared via `scripts/airport-research-shared.ts`.
 *
 * Rebuild order: editorial-only guides (no Airportist Score yet) first,
 * stalest first, then already-scored guides stalest first — so the pages
 * with the least information improve earliest in the run.
 *
 * Usage:
 *   pnpm rebuild:airports                       # every guide in the DB
 *   pnpm rebuild:airports LHR CDG               # specific airports only
 *   pnpm rebuild:airports --limit 10            # first 10 of the queue
 *   pnpm rebuild:airports --dry-run             # print the queue and exit
 *   pnpm rebuild:airports --concurrency 4       # parallel workers (default 3)
 *   pnpm rebuild:airports --force               # include guides already rebuilt today
 *
 * Requires AI_GATEWAY_API_KEY_HONESTAIRPORT_CODE (or AI_GATEWAY_API_KEY) and
 * DATABASE_URL in .env.local. Guides already rebuilt today (fresh
 * lastUpdated + scored) are skipped, so an interrupted run resumes where it
 * left off.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createGateway } from "@ai-sdk/gateway";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { fetchAllAirportGuideRows, upsertAirportGuide } from "../lib/airport-guides";
import { fetchAllAirportProfileRows, upsertAirportProfile } from "../lib/airport-profiles";
import { getAirportByIata } from "../lib/airports";
import {
  buildProfileInput,
  buildResearchPrompt,
  guideJsonSchema,
  normalizeGuideCandidate,
  toAirportContent,
  type GuideJson,
} from "./airport-research-shared";
import { extractJsonCandidates } from "./grok-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.rebuild-airports-gateway.log");
const MODEL = "xai/grok-4.5";
// grok-4.5 has been returning sustained 503s from xAI at times; same fallback
// the on-demand web generator uses so a bad xAI day doesn't stall the batch.
const FALLBACK_MODELS = ["xai/grok-4.3"];
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const ATTEMPTS_PER_AIRPORT = 3;

const apiKey =
  process.env.AI_GATEWAY_API_KEY_HONESTAIRPORT_CODE?.trim() ||
  process.env.AI_GATEWAY_API_KEY?.trim();
if (!apiKey) {
  console.error("AI_GATEWAY_API_KEY_HONESTAIRPORT_CODE (or AI_GATEWAY_API_KEY) is not configured");
  process.exit(1);
}

const gateway = createGateway({ apiKey });

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

// --- Single-airport rebuild -------------------------------------------------------

interface RebuildOutcome {
  iata: string;
  score?: number;
  profileError?: string;
  sources: number;
  totalTokens: number;
  minutes: string;
}

async function researchAirport(
  iata: string,
  extraInstructions = "",
): Promise<{ guide: GuideJson; sources: number; totalTokens: number }> {
  const result = await generateText({
    model: gateway(MODEL),
    prompt: buildResearchPrompt(iata, extraInstructions),
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // xAI's server-side web search tool, executed provider-side through the
    // gateway — real research instead of model memory. Verified via
    // result.sources / num_sources_used in the response.
    tools: {
      web_search: xai.tools.webSearch({}),
    },
    providerOptions: {
      gateway: { models: FALLBACK_MODELS },
    },
  });

  const candidates = extractJsonCandidates({ text: result.text }).map(normalizeGuideCandidate);
  for (const candidate of candidates) {
    const parsed = guideJsonSchema.safeParse(candidate);
    if (parsed.success) {
      return {
        guide: parsed.data,
        sources: result.sources?.length ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      };
    }
  }

  const firstCandidate = candidates[0];
  const detail =
    firstCandidate !== undefined
      ? guideJsonSchema
          .safeParse(firstCandidate)
          .error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      : "no JSON object found in model response";
  throw new Error(`model output failed schema validation: ${detail}`);
}

async function rebuildAirport(iata: string, extraInstructions = ""): Promise<RebuildOutcome> {
  const normalizedIata = iata.toUpperCase();
  const startedAt = Date.now();

  const { guide, sources, totalTokens } = await researchAirport(
    normalizedIata,
    extraInstructions,
  );
  if (guide.iata !== normalizedIata) {
    throw new Error(`model returned guide for ${guide.iata}, expected ${normalizedIata}`);
  }

  await upsertAirportGuide(toAirportContent(guide));

  const outcome: RebuildOutcome = {
    iata: normalizedIata,
    sources,
    totalTokens,
    minutes: ((Date.now() - startedAt) / 60_000).toFixed(1),
  };

  // A guide without a reference record (tiny airfields, junk IATAs) can't be
  // scored — keep the refreshed guide and record why instead of failing.
  try {
    const profileRow = await upsertAirportProfile(
      normalizedIata,
      buildProfileInput(normalizedIata, guide),
    );
    outcome.score = profileRow.airportistScore;
  } catch (error) {
    outcome.profileError = error instanceof Error ? error.message : String(error);
  }

  await requestSiteRevalidation();
  return outcome;
}

// --- Queue ------------------------------------------------------------------------

interface QueueEntry {
  iata: string;
  reason: string;
}

async function buildQueue(only: string[], force: boolean): Promise<QueueEntry[]> {
  const [guideRows, profileRows] = await Promise.all([
    fetchAllAirportGuideRows(),
    fetchAllAirportProfileRows(),
  ]);
  const scored = new Set(profileRows.map((row) => row.iata.toUpperCase()));
  const today = new Date().toISOString().slice(0, 10);

  if (only.length > 0) {
    return only.map((iata) => ({ iata: iata.toUpperCase(), reason: "requested explicitly" }));
  }

  const byStaleness = (a: { lastUpdated: string }, b: { lastUpdated: string }) =>
    a.lastUpdated.localeCompare(b.lastUpdated);

  const pending = guideRows.filter(
    (row) => force || !(row.lastUpdated === today && scored.has(row.iata.toUpperCase())),
  );

  const editorialOnly = pending
    .filter((row) => !scored.has(row.iata.toUpperCase()))
    .sort(byStaleness)
    .map((row) => ({
      iata: row.iata.toUpperCase(),
      reason: `editorial-only, no Airportist Score (lastUpdated ${row.lastUpdated})`,
    }));

  const refresh = pending
    .filter((row) => scored.has(row.iata.toUpperCase()))
    .sort(byStaleness)
    .map((row) => ({
      iata: row.iata.toUpperCase(),
      reason: `scored, refreshing guide (lastUpdated ${row.lastUpdated})`,
    }));

  return [...editorialOnly, ...refresh];
}

// --- Main flow --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) : Infinity;
  const concurrencyIndex = args.indexOf("--concurrency");
  const concurrency = concurrencyIndex !== -1 ? Number(args[concurrencyIndex + 1]) : 3;
  const positional = args.filter(
    (arg, index) =>
      !arg.startsWith("--") && index !== limitIndex + 1 && index !== concurrencyIndex + 1,
  );

  if (!Number.isFinite(concurrency) || concurrency < 1 || (limitIndex !== -1 && !(limit >= 1))) {
    console.error(
      "Usage: pnpm rebuild:airports [IATA ...] [--limit N] [--concurrency N] [--dry-run] [--force]",
    );
    process.exit(1);
  }

  const queue = (await buildQueue(positional, force)).slice(0, limit);
  if (queue.length === 0) {
    console.log("Nothing to rebuild (everything already refreshed today — use --force to redo).");
    return;
  }

  if (dryRun) {
    console.log(`Would rebuild ${queue.length} airports via ${MODEL} (concurrency ${concurrency}):`);
    for (const entry of queue) {
      console.log(`  ${entry.iata} — ${entry.reason}`);
    }
    return;
  }

  await logLine(
    `Starting rebuild of ${queue.length} airports via ${MODEL} (concurrency ${concurrency})`,
  );

  const failures: Array<{ iata: string; error: string }> = [];
  let completed = 0;
  let tokensUsed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const entry = queue[cursor++];
      let lastError = "";

      for (let attempt = 1; attempt <= ATTEMPTS_PER_AIRPORT; attempt++) {
        try {
          // Feed the previous attempt's validation errors back into the
          // prompt — the model reliably fixes the exact fields it shorted.
          const feedback = lastError
            ? `IMPORTANT — your previous response was rejected by schema validation: ${lastError}. Fix exactly these issues and meet every hard minimum this time.`
            : "";
          const outcome = await rebuildAirport(entry.iata, feedback);
          completed++;
          tokensUsed += outcome.totalTokens;
          const scorePart =
            outcome.score !== undefined
              ? `Airportist Score ${outcome.score}`
              : `guide only (${outcome.profileError})`;
          await logLine(
            `✅ [${completed + failures.length}/${queue.length}] ${entry.iata} — ${scorePart}, ` +
              `${outcome.sources} web sources, ${outcome.minutes} min (${entry.reason})`,
          );
          lastError = "";
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt < ATTEMPTS_PER_AIRPORT) {
            await logLine(`↻ ${entry.iata} attempt ${attempt} failed, retrying: ${lastError}`);
          }
        }
      }

      if (lastError) {
        failures.push({ iata: entry.iata, error: lastError });
        await logLine(`❌ ${entry.iata} failed after ${ATTEMPTS_PER_AIRPORT} attempts: ${lastError}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

  await logLine(
    `Done: ${completed}/${queue.length} rebuilt, ${failures.length} failed, ` +
      `${tokensUsed.toLocaleString()} tokens used`,
  );
  if (failures.length > 0) {
    await logLine(`Failed airports: ${failures.map((f) => f.iata).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(`❌ Batch failed: ${message}`);
  process.exit(1);
});
