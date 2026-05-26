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
import fs from "node:fs/promises";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "content/airports");

async function generateAirportPage(iata: string, extraInstructions = "") {
  const normalizedIata = iata.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are an expert travel researcher creating the single best, most practical one-page guide for ${normalizedIata} airport.

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
---

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

  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });

  const result = streamText({
    model: gateway("xai/grok-4.3"),
    prompt,
    temperature: 0.3,
  });

  const text = await result.text;
  const filename = `${normalizedIata.toLowerCase()}.md`;
  const filepath = path.join(CONTENT_DIR, filename);

  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.writeFile(filepath, text.trim() + "\n");

  console.log(`✅ Generated ${filepath}`);
  console.log("⚠️  Please review carefully for accuracy before committing.");
}

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
