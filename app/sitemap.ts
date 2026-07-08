import type { MetadataRoute } from "next";
import {
  getAllAirports,
  getAirportSlugs,
  getAllAirportIatas,
} from "@/lib/airport-content";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guideIatas, guideSummaries, scoredSlugs] = await Promise.all([
    getAllAirportIatas(),
    getAllAirports(),
    getAirportSlugs(),
  ]);
  const lastUpdatedByIata = new Map(
    guideSummaries.map((guide) => [guide.iata.toUpperCase(), guide.lastUpdated]),
  );
  const slugs = new Set([
    ...scoredSlugs,
    ...guideIatas.map((iata) => iata.toLowerCase()),
  ]);

  const airportEntries = [...slugs].sort().map((slug): MetadataRoute.Sitemap[number] => {
    const lastUpdated = lastUpdatedByIata.get(slug.toUpperCase());

    return {
      url: `${SITE_URL}/airports/${slug}`,
      lastModified: lastUpdated ? new Date(lastUpdated) : undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    };
  });
  const latestGuideUpdate = airportEntries
    .map((entry) => entry.lastModified)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return [
    {
      url: SITE_URL,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...airportEntries,
  ];
}
