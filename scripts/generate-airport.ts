#!/usr/bin/env tsx
/**
 * AI SDK-powered Airport Page Generator (using Grok 4.3 via Vercel AI Gateway)
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=xxx pnpm generate:airport LHR
 *   AI_GATEWAY_API_KEY=xxx pnpm generate:airport CDG "Focus on family travel and long-haul connections"
 *
 * IMPORTANT: Always review and fact-check the output before committing.
 */

import { streamText } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  airportGuideExists,
  parseAirportGuideMarkdown,
  upsertAirportGuide,
} from "../lib/airport-guides";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

export function buildAirportGenerationPrompt(iata: string, extraInstructions = ""): string {
  const normalizedIata = iata.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  return `You are an expert travel researcher creating the single best, most practical one-page guide for ${normalizedIata} airport.

Write in clean, scannable Markdown.

Start with YAML frontmatter in this exact shape:

---
iata: "${normalizedIata}"
name: "Full official airport name"
city: "City"
country: "Country"
lastUpdated: "${today}"
sources:
  - "https://official-airport-site.example"
  - "https://relevant-security-or-transport-authority.example"
quickFacts:
  - "4-6 short bullet facts as YAML strings"
bentoTips:
  - category: "timing"
    label: "Timing"
    title: "Short imperative headline"
    summary: "One-sentence takeaway a traveler can act on."
    detail: "One extra sentence of context (when it applies, what to avoid)."
lounges:
  - name: "Official lounge name"
    terminal: "Terminal 1"
    zone: "non-Schengen"
    access:
      - "Priority Pass"
      - "Star Alliance Gold"
      - "Day pass ~€50"
    hours: "05:00-22:00"
    amenities:
      - "Showers"
      - "Quiet zone"
    bestFor:
      - "Work"
      - "Long layovers"
    verdict: "worth-it"
    summary: "One honest sentence on whether this lounge is worth the visit."
---

Include exactly 4 bentoTips, one for each category in this order: "timing", "terminal", "food", "status". Each label is a 1-2 word display tag (e.g. "Timing", "Transfers", "Food & quiet", "Live checks"). These are the highest-signal tips for this airport — they are shown prominently, so do not waste them on generic advice.

Include 2-5 lounges covering the airport's most relevant options for ordinary travelers (independent/Priority Pass lounges and flagship airline lounges). \`zone\` is optional — use it for Schengen/non-Schengen or domestic/international splits. \`verdict\` must be exactly one of "worth-it", "depends", or "skip". Only state access rules, hours, and amenities you are confident about; omit a field rather than guessing.

Then continue with the page body using this exact heading structure:

# ${normalizedIata} Airport Guide

> One-sentence high-signal summary focused on why this page is useful.

## Quick Facts
- Bullet list of 4-6 truly important facts (terminals, major airlines, unique characteristics).

## Security & Screening Tips
- The most important, actionable security advice specific to this airport (TSA or local equivalent, PreCheck/Clear status, known pain points, times of day to avoid).

## Best Airport Tricks & Hacks
- 5-8 genuinely clever, practical tricks that experienced travelers actually use here. Be specific. Include context ("works best when...", "avoid if...").

## Terminals & Navigation
- High-level but useful navigation guidance, walking times, best connections, common mistakes.

## Lounges, Food & Amenities
- Honest recommendations of the actually good options (not just paid advertising). Call out standout food or quiet spots.

## Ground Transport & Parking
- Practical advice on the best ways in/out, costs, and insider timing tips.

## Official Sources
- List the key official links travelers should bookmark.

Tone: Direct, slightly opinionated, zero fluff. Prioritize traveler time-saving and stress reduction.
Use real official URLs in frontmatter sources whenever possible.

IATA: ${normalizedIata}
${extraInstructions ? `Additional focus: ${extraInstructions}` : ""}

Output ONLY the raw Markdown file (frontmatter + body). No explanations before or after.`;
}

export { airportGuideExists as airportContentExists };

export async function generateAirportPage(iata: string, extraInstructions = "") {
  const normalizedIata = iata.toUpperCase();
  const prompt = buildAirportGenerationPrompt(normalizedIata, extraInstructions);

  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });

  const result = streamText({
    model: gateway("xai/grok-4.3"),
    prompt,
    temperature: 0.3,
  });

  const text = await result.text;

  // Validates the guide and snapshots any previous version before writing.
  const row = await upsertAirportGuide(parseAirportGuideMarkdown(text.trim()));
  await requestSiteRevalidation();

  console.log(`✅ Generated guide for ${row.iata} (stored in Postgres)`);

  return row.iata;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const iata = process.argv[2];
  const extra = process.argv.slice(3).join(" ");

  if (!iata) {
    console.error("Usage: pnpm generate:airport <IATA> [extra instructions]");
    process.exit(1);
  }

  generateAirportPage(iata, extra).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
