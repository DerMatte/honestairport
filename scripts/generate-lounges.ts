#!/usr/bin/env tsx
/**
 * Backfill structured `lounges` frontmatter for existing airport guides.
 *
 * Uses the guide's own "Lounges, Food & Amenities" section as grounding and
 * patches the YAML frontmatter in place. Files that already have `lounges`
 * are skipped.
 *
 * Usage:
 *   pnpm generate:lounges               # all guides missing lounges
 *   pnpm generate:lounges --limit 5     # patch up to 5
 *   pnpm generate:lounges --only AMS,LHR
 *   pnpm generate:lounges --dry-run     # list what would be patched
 *
 * Logs progress to scripts/.generate-lounges.log
 */

import fs from "node:fs/promises";
import path from "node:path";
import { generateObject } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import matter from "gray-matter";
import { z } from "zod";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const CONTENT_DIR = path.join(process.cwd(), "content/airports");
const LOG_FILE = path.join(process.cwd(), "scripts/.generate-lounges.log");
const CONCURRENCY = 3;

const loungeSchema = z.object({
  name: z.string().min(1),
  terminal: z.string().min(1),
  zone: z
    .string()
    .describe('Schengen/non-Schengen or domestic/international split; "" if not applicable'),
  access: z
    .array(z.string())
    .describe("Access routes: airline status, alliance tiers, Priority Pass, day-pass pricing"),
  hours: z.string().describe('Opening hours like "05:00-23:00"; "" if unknown'),
  amenities: z.array(z.string()).describe("Only amenities you are confident about"),
  bestFor: z.array(z.string()).describe('1-3 short tags like "Work", "Sleep", "Families"'),
  verdict: z.enum(["worth-it", "depends", "skip"]),
  summary: z.string().min(1).describe("One honest sentence on whether it is worth the visit"),
});

const loungesResultSchema = z.object({
  lounges: z.array(loungeSchema).min(1).max(6),
});

type LoungeResult = z.infer<typeof loungesResultSchema>;

interface BackfillOptions {
  limit: number;
  dryRun: boolean;
  only: string[];
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  let limit = Number.POSITIVE_INFINITY;
  let dryRun = false;
  let only: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit" && args[i + 1]) {
      limit = Math.max(1, Number.parseInt(args[++i], 10) || 1);
    } else if (arg === "--only" && args[i + 1]) {
      only = args[++i]
        .split(",")
        .map((iata) => iata.trim().toUpperCase())
        .filter(Boolean);
    }
  }

  return { limit, dryRun, only };
}

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n");
}

function extractLoungeSection(content: string): string {
  const headings = [...content.matchAll(/^##\s+(.+)$/gm)];

  for (let i = 0; i < headings.length; i++) {
    if (!/lounge/i.test(headings[i][1])) continue;
    const start = (headings[i].index ?? 0) + headings[i][0].length;
    const end = headings[i + 1]?.index ?? content.length;
    return content.slice(start, end).trim();
  }

  return "";
}

function buildPrompt(frontmatter: Record<string, unknown>, loungeNotes: string): string {
  const airport = `${frontmatter.name} (${frontmatter.iata}) in ${frontmatter.city}, ${frontmatter.country}`;

  return `You are an expert travel researcher documenting airport lounges for ${airport}.

Produce structured data for the 2-5 lounges most relevant to ordinary travelers at this airport: independent / Priority Pass lounges and the flagship airline lounges. Cover different terminals where the airport has several.

Rules:
- Only state access rules, opening hours, and amenities you are confident about. Use "" or an empty list when unsure — never guess.
- "verdict" is your honest call: "worth-it", "depends" (e.g. only with free access), or "skip".
- "summary" is one direct, slightly opinionated sentence a traveler can act on.

Our existing editorial notes for this airport (use as grounding, but correct them if wrong):
${loungeNotes || "(none)"}`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function loungesToYaml(lounges: LoungeResult["lounges"]): string {
  const lines: string[] = ["lounges:"];

  for (const lounge of lounges) {
    lines.push(`  - name: ${yamlString(lounge.name)}`);
    lines.push(`    terminal: ${yamlString(lounge.terminal)}`);
    if (lounge.zone.trim()) {
      lines.push(`    zone: ${yamlString(lounge.zone)}`);
    }
    if (lounge.access.length) {
      lines.push("    access:");
      for (const item of lounge.access) {
        lines.push(`      - ${yamlString(item)}`);
      }
    }
    if (lounge.hours.trim()) {
      lines.push(`    hours: ${yamlString(lounge.hours)}`);
    }
    if (lounge.amenities.length) {
      lines.push("    amenities:");
      for (const item of lounge.amenities) {
        lines.push(`      - ${yamlString(item)}`);
      }
    }
    if (lounge.bestFor.length) {
      lines.push("    bestFor:");
      for (const item of lounge.bestFor) {
        lines.push(`      - ${yamlString(item)}`);
      }
    }
    lines.push(`    verdict: ${yamlString(lounge.verdict)}`);
    lines.push(`    summary: ${yamlString(lounge.summary)}`);
  }

  return lines.join("\n");
}

function insertLoungesFrontmatter(raw: string, loungesYaml: string): string {
  const lines = raw.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new Error("file does not start with YAML frontmatter");
  }

  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (closeIndex === -1) {
    throw new Error("could not find closing frontmatter delimiter");
  }

  lines.splice(closeIndex, 0, ...loungesYaml.split("\n"));
  return lines.join("\n");
}

async function patchAirport(
  gateway: ReturnType<typeof createGateway>,
  filePath: string,
  raw: string,
  frontmatter: Record<string, unknown>,
  loungeNotes: string,
) {
  const { object } = await generateObject({
    model: gateway("xai/grok-4.3"),
    schema: loungesResultSchema,
    prompt: buildPrompt(frontmatter, loungeNotes),
    temperature: 0.2,
  });

  const patched = insertLoungesFrontmatter(raw, loungesToYaml(object.lounges));

  // Make sure the patched frontmatter still parses before committing it.
  const reparsed = matter(patched);
  if (!Array.isArray(reparsed.data.lounges) || reparsed.data.lounges.length === 0) {
    throw new Error("patched frontmatter failed to re-parse");
  }

  await fs.writeFile(filePath, patched);
  return object.lounges.length;
}

async function runBackfill() {
  const options = parseArgs();

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    console.error("Missing AI_GATEWAY_API_KEY. Add it to .env.local or export it in your shell.");
    process.exit(1);
  }

  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const files = (await fs.readdir(CONTENT_DIR)).filter((file) => file.endsWith(".md")).sort();

  const pending: { iata: string; filePath: string }[] = [];

  for (const file of files) {
    const iata = file.replace(/\.md$/, "").toUpperCase();
    if (options.only.length && !options.only.includes(iata)) continue;

    const filePath = path.join(CONTENT_DIR, file);
    const { data } = matter(await fs.readFile(filePath, "utf8"));

    if (Array.isArray(data.lounges) && data.lounges.length > 0) continue;
    if (pending.length >= options.limit) break;
    pending.push({ iata, filePath });
  }

  if (pending.length === 0) {
    console.log("All matching guides already have lounges frontmatter.");
    return;
  }

  await logLine(
    `Lounge backfill start: ${pending.length} guide(s)${options.dryRun ? " (dry run)" : ""} — ${pending.map((p) => p.iata).join(", ")}`,
  );

  if (options.dryRun) return;

  let succeeded = 0;
  let failed = 0;
  const queue = [...pending];

  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;

      try {
        const raw = await fs.readFile(item.filePath, "utf8");
        const { data, content } = matter(raw);
        const count = await patchAirport(
          gateway,
          item.filePath,
          raw,
          data,
          extractLoungeSection(content),
        );
        succeeded++;
        await logLine(`Patched ${item.iata} with ${count} lounge(s) [${succeeded + failed}/${pending.length}]`);
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        await logLine(`Failed ${item.iata}: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await logLine(`Lounge backfill complete: ${succeeded} succeeded, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runBackfill().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] Fatal: ${message}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});
