import "server-only";

import { tool } from "ai";
import { z } from "zod";
import {
  getAirportContent,
  getAirportProfile,
  getAirportGuideSummary,
} from "@/lib/airport-content";
import { searchAirports } from "@/lib/airport-search";

function guideFreshness(lastUpdated: string) {
  const updatedAt = new Date(lastUpdated);
  if (Number.isNaN(updatedAt.getTime())) {
    return { status: "unknown" as const, ageDays: null };
  }

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return {
    status: ageDays > 180 ? ("stale" as const) : ("recent-editorial" as const),
    ageDays,
  };
}

const iataSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{3}$/, "Use a three-letter IATA code")
  .transform((value) => value.toUpperCase());

export const searchAirportDirectory = tool({
  description:
    "Search HonestAirport's airport directory by IATA code, airport name, city, or country. Use this before retrieval when the airport is ambiguous.",
  inputSchema: z.object({
    query: z.string().trim().min(2).max(80),
  }),
  execute: async ({ query }) => {
    const results = await searchAirports(query);
    return {
      query,
      matches: results.airports.slice(0, 6).map((airport) => ({
        iata: airport.iata,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        airportistScore: airport.score ?? null,
        guideUrl: `/airports/${airport.slug}`,
      })),
      note:
        "A directory match can be a reference-only airport. Use getAirportGuideAndProfile to confirm that HonestAirport has editorial content.",
    };
  },
});

export const getAirportGuideAndProfile = tool({
  description:
    "Retrieve HonestAirport's own editorial guide and Airportist Score profile for one exact IATA code. This is the only source for factual answers.",
  inputSchema: z.object({ iata: iataSchema }),
  execute: async ({ iata }) => {
    const [content, profile] = await Promise.all([
      getAirportContent(iata),
      getAirportProfile(iata),
    ]);

    if (!content && !profile) {
      return {
        iata,
        found: false,
        message: "HonestAirport does not currently have a guide or scored profile for this airport.",
      };
    }

    const guide = content ? getAirportGuideSummary(content) : null;

    return {
      iata,
      found: true,
      pageUrl: `/airports/${iata.toLowerCase()}`,
      guide: content
        ? {
            airport: {
              name: content.frontmatter.name,
              city: content.frontmatter.city,
              country: content.frontmatter.country,
              officialWebsite: content.frontmatter.officialWebsite ?? null,
            },
            lastUpdated: content.frontmatter.lastUpdated,
            freshness: guideFreshness(content.frontmatter.lastUpdated),
            quickFacts: guide?.quickFacts ?? [],
            importantTips: guide?.importantTips ?? [],
            lounges: guide?.lounges ?? [],
            waterOptions: guide?.waterOptions ?? [],
            sections: guide?.sections ?? {},
            sourceLinks: guide?.sourceLinks ?? [],
            editorialMarkdown: content.content.slice(0, 24_000),
            truncated: content.content.length > 24_000,
          }
        : null,
      profile: profile
        ? {
            airportistScore: profile.airportistScore,
            scoreBreakdown: profile.scoreBreakdown,
            summary: profile.summary,
            bestFor: profile.bestFor,
            watchOutFor: profile.watchOutFor,
            stats: profile.stats,
            amenities: profile.amenities,
            tips: profile.tips,
            transport: profile.transport,
            disruption: profile.disruption,
          }
        : null,
      freshnessWarning:
        "This is editorial snapshot data, not live operational data. Terminals, hours, access rules, queues, prices, and disruption conditions can change.",
    };
  },
});

export const honestAirportTools = {
  searchAirportDirectory,
  getAirportGuideAndProfile,
};
