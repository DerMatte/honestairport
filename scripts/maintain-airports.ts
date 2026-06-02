#!/usr/bin/env tsx
/**
 * Generate missing airport guides and refresh existing guides with Grok 4.3
 * through Vercel AI Gateway plus Gateway web search.
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=xxx pnpm maintain:airports
 *   AI_GATEWAY_API_KEY=xxx pnpm maintain:airports --generate-limit 3 --review-limit 5
 *   pnpm maintain:airports --dry-run
 */

import { generateText, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import fs from "node:fs/promises";
import path from "node:path";
import { AIRPORT_REVIEW_STYLE } from "../lib/airport-review-brief";
import { getMajorAirportCandidates, type MajorAirportCandidate } from "../lib/major-airports";
import { airportContentExists, CONTENT_DIR, generateAirportPage } from "./generate-airport";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.maintain-airports.log");
const DEFAULT_GENERATE_LIMIT = 3;
const DEFAULT_REVIEW_LIMIT = 5;
const DELAY_MS = 3_000;

const REQUIRED_HEADING_GROUPS = [
  ["## Quick Facts"],
  ["## Security & Screening Tips"],
  ["## Best Airport Tricks & Hacks"],
  ["## Terminals & Navigation"],
  ["## Lounges Food & Amenities", "## Lounges, Food & Amenities"],
  ["## Ground Transport & Parking"],
  ["## Official Sources"],
] as const;

interface MaintenanceOptions {
  dryRun: boolean;
  fromRank: number;
  generateLimit: number;
  reviewLimit: number;
  generateOnly: boolean;
  reviewOnly: boolean;
  iata?: string;
}

interface ExistingAirportPage {
  iata: string;
  rank: number;
  name: string;
  filePath: string;
  lastUpdated: string;
}

interface MaintenanceSummary {
  generated: string[];
  reviewed: string[];
  unchanged: string[];
  failed: string[];
}

function parseArgs(): MaintenanceOptions {
  const args = process.argv.slice(2);
  const options: MaintenanceOptions = {
    dryRun: false,
    fromRank: 1,
    generateLimit: DEFAULT_GENERATE_LIMIT,
    reviewLimit: DEFAULT_REVIEW_LIMIT,
    generateOnly: false,
    reviewOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--generate-only") {
      options.generateOnly = true;
    } else if (arg === "--review-only") {
      options.reviewOnly = true;
    } else if (arg === "--generate-limit" && next) {
      options.generateLimit = Math.max(0, Number.parseInt(next, 10) || DEFAULT_GENERATE_LIMIT);
      i++;
    } else if (arg === "--review-limit" && next) {
      options.reviewLimit = Math.max(0, Number.parseInt(next, 10) || DEFAULT_REVIEW_LIMIT);
      i++;
    } else if (arg === "--from-rank" && next) {
      options.fromRank = Math.max(1, Number.parseInt(next, 10) || 1);
      i++;
    } else if (arg === "--iata" && next) {
      options.iata = next.toUpperCase();
      i++;
    } else if (/^[A-Za-z]{3}$/.test(arg)) {
      options.iata = arg.toUpperCase();
    }
  }

  if (options.generateOnly && options.reviewOnly) {
    throw new Error("Use either --generate-only or --review-only, not both.");
  }

  if (options.iata) {
    options.generateLimit = options.reviewOnly ? 0 : 1;
    options.reviewLimit = options.generateOnly ? 0 : 1;
  }

  return options;
}

function requireGatewayApiKey() {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    throw new Error("Missing AI_GATEWAY_API_KEY. Add it to .env.local or export it in your shell.");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n");
}

async function readAirportMarkdown(iata: string) {
  const filePath = path.join(CONTENT_DIR, `${iata.toLowerCase()}.md`);
  return {
    filePath,
    markdown: await fs.readFile(filePath, "utf8"),
  };
}

function extractLastUpdated(markdown: string): string {
  return markdown.match(/^lastUpdated:\s*"?([^"\n]+)"?/m)?.[1]?.trim() ?? "0000-00-00";
}

function normalizeModelMarkdown(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim() + "\n";
}

function isNoChangesResponse(text: string): boolean {
  return /^NO_CHANGES\b/i.test(text.trim());
}

function validateAirportMarkdown(iata: string, markdown: string) {
  if (!markdown.startsWith("---\n")) {
    throw new Error(`${iata}: response is missing YAML frontmatter`);
  }

  if (!new RegExp(`^iata:\\s*"?${iata}"?\\s*$`, "im").test(markdown)) {
    throw new Error(`${iata}: response frontmatter does not contain the expected IATA code`);
  }

  for (const headingGroup of REQUIRED_HEADING_GROUPS) {
    if (!headingGroup.some((heading) => markdown.includes(heading))) {
      throw new Error(`${iata}: response is missing required heading ${headingGroup[0]}`);
    }
  }
}

function buildGatewayReviewPrompt(iata: string, currentMarkdown: string): string {
  const today = new Date().toISOString().slice(0, 10);

  return `
You maintain TravelGuide airport Markdown pages. Review and improve the ${iata} page using current online data.

${AIRPORT_REVIEW_STYLE}

## App-specific frontmatter

The site also reads optional \`bentoTips\` from frontmatter. If present, preserve and improve it.
If missing, add exactly four \`bentoTips\` entries with categories \`timing\`, \`terminal\`, \`food\`, and \`status\`.

## Review task

1. Use the available web search tool for current official airport, transport authority, alliance, and airline pages.
2. Add or tighten useful tips and tricks: realistic connection buffers, terminal traps, water/power, lounge gotchas, security peaks, and best transport choices.
3. Update \`lastUpdated\` to "${today}" only if you make material changes.
4. Add source URLs to frontmatter when you rely on them.
5. Preserve the existing heading structure and raw Markdown format.
6. Do not invent prices, exact waits, or access rules. Verify or say "check before travel".

Return exactly one of:
- The complete revised Markdown file, starting with YAML frontmatter.
- \`NO_CHANGES\` if the current page is already strong and current.

Current file:

${currentMarkdown}
`.trim();
}

async function selectMissingAirports(options: MaintenanceOptions): Promise<MajorAirportCandidate[]> {
  if (options.reviewOnly || options.generateLimit === 0) return [];

  const candidates = getMajorAirportCandidates().filter((airport) => airport.rank >= options.fromRank);

  if (options.iata) {
    const candidate = candidates.find((airport) => airport.iata === options.iata);
    if (!candidate || (await airportContentExists(options.iata))) return [];
    return [candidate];
  }

  const selected: MajorAirportCandidate[] = [];
  for (const airport of candidates) {
    if (selected.length >= options.generateLimit) break;
    if (await airportContentExists(airport.iata)) continue;
    selected.push(airport);
  }

  return selected;
}

async function getExistingMajorAirportPages(excludeIatas = new Set<string>()): Promise<ExistingAirportPage[]> {
  const pages: ExistingAirportPage[] = [];

  for (const airport of getMajorAirportCandidates()) {
    if (excludeIatas.has(airport.iata) || !(await airportContentExists(airport.iata))) continue;

    const { filePath, markdown } = await readAirportMarkdown(airport.iata);
    pages.push({
      iata: airport.iata,
      rank: airport.rank,
      name: airport.name,
      filePath,
      lastUpdated: extractLastUpdated(markdown),
    });
  }

  return pages.sort((a, b) => {
    const dateOrder = a.lastUpdated.localeCompare(b.lastUpdated);
    return dateOrder === 0 ? a.rank - b.rank : dateOrder;
  });
}

async function selectReviewAirports(
  options: MaintenanceOptions,
  generatedIatas: string[],
): Promise<ExistingAirportPage[]> {
  if (options.generateOnly || options.reviewLimit === 0) return [];

  const generatedSet = new Set(generatedIatas);

  if (options.iata) {
    if (!(await airportContentExists(options.iata))) return [];
    const pages = await getExistingMajorAirportPages();
    const page = pages.find((entry) => entry.iata === options.iata);
    return page ? [page] : [];
  }

  const generatedPages = (await getExistingMajorAirportPages()).filter((page) =>
    generatedSet.has(page.iata),
  );
  const stalePages = (await getExistingMajorAirportPages(generatedSet)).slice(
    0,
    Math.max(0, options.reviewLimit - generatedPages.length),
  );

  return [...generatedPages, ...stalePages].slice(0, options.reviewLimit);
}

async function reviewAirportPageWithGateway(iata: string): Promise<"updated" | "unchanged"> {
  const { filePath, markdown } = await readAirportMarkdown(iata);
  const result = await generateText({
    model: gateway("xai/grok-4.3"),
    tools: {
      perplexity_search: gateway.tools.perplexitySearch({
        maxResults: 10,
        // searchLanguageFilter: ["en"],
      }),
    },
    stopWhen: stepCountIs(5),
    temperature: 0.2,
    prompt: buildGatewayReviewPrompt(iata, markdown),
  });

  if (isNoChangesResponse(result.text)) {
    return "unchanged";
  }

  const updatedMarkdown = normalizeModelMarkdown(result.text);
  validateAirportMarkdown(iata, updatedMarkdown);

  if (updatedMarkdown.trim() === markdown.trim()) {
    return "unchanged";
  }

  await fs.writeFile(filePath, updatedMarkdown);
  return "updated";
}

async function runMaintenance() {
  const options = parseArgs();
  const summary: MaintenanceSummary = {
    generated: [],
    reviewed: [],
    unchanged: [],
    failed: [],
  };

  const missingAirports = await selectMissingAirports(options);

  if (options.dryRun) {
    const reviewAirports = await selectReviewAirports(
      options,
      missingAirports.map((airport) => airport.iata),
    );

    console.log("Dry run: no Gateway calls or file writes.");
    console.log(
      `Would generate: ${missingAirports.length ? missingAirports.map((airport) => `#${airport.rank} ${airport.iata}`).join(", ") : "none"}`,
    );
    console.log(
      `Would review: ${reviewAirports.length ? reviewAirports.map((airport) => `${airport.iata} (${airport.lastUpdated})`).join(", ") : "none"}`,
    );
    return;
  }

  requireGatewayApiKey();
  await logLine(
    `Maintenance start: generate=${missingAirports.length}, reviewLimit=${options.reviewLimit}`,
  );

  for (const [index, airport] of missingAirports.entries()) {
    try {
      await logLine(`Generating #${airport.rank} ${airport.iata} (${airport.name}) with Grok/Gateway...`);
      await generateAirportPage(
        airport.iata,
        "Use current official airport, transport, airline, and alliance sources. Include practical traveler tips and tricks, not generic airport marketing.",
      );
      summary.generated.push(airport.iata);
    } catch (error) {
      summary.failed.push(airport.iata);
      await logLine(`Failed to generate ${airport.iata}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (index < missingAirports.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const reviewAirports = await selectReviewAirports(options, summary.generated);

  for (const [index, airport] of reviewAirports.entries()) {
    try {
      await logLine(`Reviewing ${airport.iata} (${airport.name}) with Grok/Gateway web search...`);
      const status = await reviewAirportPageWithGateway(airport.iata);
      if (status === "updated") {
        summary.reviewed.push(airport.iata);
      } else {
        summary.unchanged.push(airport.iata);
      }
    } catch (error) {
      summary.failed.push(airport.iata);
      await logLine(`Failed to review ${airport.iata}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (index < reviewAirports.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await logLine(
    `Maintenance complete: generated=${summary.generated.join(", ") || "none"}; reviewed=${summary.reviewed.join(", ") || "none"}; unchanged=${summary.unchanged.join(", ") || "none"}; failed=${summary.failed.join(", ") || "none"}`,
  );

  if (summary.failed.length > 0) {
    process.exitCode = 2;
  }
}

runMaintenance().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] Fatal: ${message}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});
