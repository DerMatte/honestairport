import { createGateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { regionForCountryCode, type AirportProfileInput } from "@/lib/airport-profiles";
import { airportScoreProfileSchema } from "@/lib/airport-profile-schema";
import type { AirportRecord } from "@/lib/airports";

function buildAirportScorePrompt(iata: string, record: AirportRecord, guideMarkdown: string): string {
  const normalizedIata = iata.toUpperCase();

  return `You are scoring ${normalizedIata} airport (${record.name}, ${record.city_name}) for the Airportist Score, a 0-10 traveler-experience rating.

A traveler guide for this airport was just researched and written. Use it, plus what you know about this airport, to produce an honest, specific Airportist Score profile. Do not invent facts that contradict the guide below.

--- GUIDE ---
${guideMarkdown}
--- END GUIDE ---

Calibrate \`airportistScore\` against these anchors:
- 9.0-10: exceptional, best-in-class (e.g. Singapore Changi tier) — reserve for airports with genuinely outstanding, well-documented traveler experience.
- 7.5-8.9: very good, few real complaints.
- 6.0-7.4: solid but with clear, specific tradeoffs.
- Below 6.0: real, well-documented traveler pain points (chronic delays, poor facilities, notoriously difficult layout, or a small/basic airfield with minimal services).
Do not cluster every airport at 7-8 — differentiate based on what you actually know. \`airportistScore\` should read as a holistic judgment close to (but not necessarily exactly) the average of \`scoreBreakdown\`'s five components.

For \`transport\`, compare the non-parking options against each other and tag the actual winners with \`bestFor\`: the single fastest, the single cheapest, and the single best for a traveler with a lot of luggage. One option can win more than one category if it genuinely does (omit \`bestFor\` on options that don't win anything, and never tag \`parking\`).

\`disruption\` is a periodic editorial snapshot (not live data — a separate live-status system covers real-time delays elsewhere on the site); base it on typical operational performance for this airport, not on today's weather.

If this is a small or regional airport with limited amenities, reflect that honestly in the score and amenities/tips rather than padding with generic filler — every field must be specific to ${normalizedIata}.

IATA: ${normalizedIata}`;
}

/**
 * Produces the Airportist Score profile for an airport that just got its
 * on-demand guide generated, so every generated page ends up scored instead
 * of stuck as an editorial-only guide. Reuses the freshly generated guide
 * markdown as grounding context instead of re-researching from scratch.
 */
export async function generateAirportScoreProfile(
  iata: string,
  record: AirportRecord,
  guideMarkdown: string,
): Promise<AirportProfileInput> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }

  const gateway = createGateway({ apiKey });
  const normalizedIata = iata.toUpperCase();

  const { object } = await generateObject({
    model: gateway("xai/grok-4.5"),
    schema: airportScoreProfileSchema,
    prompt: buildAirportScorePrompt(normalizedIata, record, guideMarkdown),
    temperature: 0.3,
  });

  return {
    // Empty when the reference record has no ICAO (1.2k smaller airfields) —
    // UI and JSON-LD treat "" as absent rather than blocking the score.
    icao: record.icao_code ?? "",
    shortName: object.shortName,
    // Region drives filter grouping and must stay internally consistent, so
    // it comes from the deterministic country-code map whenever possible; the
    // model's answer only fills the gap for countries not mapped yet.
    region: regionForCountryCode(record.iata_country_code) ?? object.region,
    latitude: record.latitude,
    longitude: record.longitude,
    airportistScore: object.airportistScore,
    scoreBreakdown: object.scoreBreakdown,
    stats: object.stats,
    summary: object.summary,
    bestFor: object.bestFor,
    watchOutFor: object.watchOutFor,
    amenities: object.amenities.map((amenity, index) => ({
      id: `${normalizedIata.toLowerCase()}-amenity-${index + 1}`,
      ...amenity,
    })),
    tips: object.tips.map((tip, index) => ({
      id: `${normalizedIata.toLowerCase()}-tip-${index + 1}`,
      ...tip,
    })),
    transport: object.transport,
    disruption: {
      ...object.disruption,
      alerts: object.disruption.alerts ?? [],
      lastUpdated: new Date().toISOString(),
    },
  };
}
