import { createGateway } from "@ai-sdk/gateway";
import { streamText } from "ai";
import type { AirportRecord } from "@/lib/airports";

export function buildAirportGenerationPrompt(
  iata: string,
  record?: AirportRecord,
  extraInstructions = "",
): string {
  const normalizedIata = iata.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  const referenceBlock = record
    ? `
Reference airport data (use these exact values in frontmatter where applicable):
- IATA: ${record.iata_code}
- Official name: ${record.name}
- City: ${record.city_name}
- Country code: ${record.iata_country_code}
${record.icao_code ? `- ICAO: ${record.icao_code}` : ""}
- Coordinates: ${record.latitude}, ${record.longitude}
`
    : "";

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

Include 2-5 lounges covering the airport's most relevant options for ordinary travelers (independent/Priority Pass lounges and flagship airline lounges). \`zone\` is optional — use it for Schengen/non-Schengen or domestic/international splits. \`verdict\` must be exactly one of "worth-it", "depends", or "skip". Only state access rules, hours, and amenities you are confident about; omit a field rather than guessing. If this airport genuinely has no lounge of any kind, set \`lounges\` to an empty array — do not invent a placeholder "no lounge" entry — and say so plainly in the Lounges, Food & Amenities section instead.

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
${referenceBlock}
IATA: ${normalizedIata}
${extraInstructions ? `Additional focus: ${extraInstructions}` : ""}

Output ONLY the raw Markdown file (frontmatter + body). No explanations before or after.`;
}

export function createAirportGuideStream(
  iata: string,
  record?: AirportRecord,
  extraInstructions = "",
) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }

  const gateway = createGateway({ apiKey });
  const prompt = buildAirportGenerationPrompt(iata, record, extraInstructions);

  return streamText({
    model: gateway("xai/grok-4.5"),
    prompt,
    temperature: 0.3,
    providerOptions: {
      // grok-4.5 has been returning sustained 503s from xAI; without fallback
      // models the gateway gives up and on-the-fly generation dies entirely.
      gateway: {
        models: ["xai/grok-4.3", "anthropic/claude-sonnet-5"],
      },
    },
  });
}

export { extractStreamableGuideBody } from "./airport-guide-markdown";