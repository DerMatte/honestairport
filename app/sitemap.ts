import type { MetadataRoute } from "next";
import {
  getAirportContent,
  getAirportSlugs,
  getAllAirportIatas,
  getAllAirportLoungeParams,
} from "@/lib/airport-content";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guideIatas, scoredSlugs] = await Promise.all([
    getAllAirportIatas(),
    getAirportSlugs(),
  ]);
  const slugs = new Set([
    ...scoredSlugs,
    ...guideIatas.map((iata) => iata.toLowerCase()),
  ]);

  const airportEntries = await Promise.all(
    [...slugs].sort().map(async (slug): Promise<MetadataRoute.Sitemap[number]> => {
      const content = await getAirportContent(slug);
      const lastUpdated = content?.frontmatter.lastUpdated;

      return {
        url: `${SITE_URL}/airports/${slug}`,
        lastModified: lastUpdated ? new Date(lastUpdated) : undefined,
        changeFrequency: "monthly",
        priority: 0.8,
      };
    }),
  );
  const latestGuideUpdate = airportEntries
    .map((entry) => entry.lastModified)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const loungeEntries = (await getAllAirportLoungeParams()).map(
    ({ iata, slug, updatedAt }): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/airports/${iata.toLowerCase()}/lounge/${slug}`,
      lastModified: updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  return [
    {
      url: SITE_URL,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...airportEntries,
    ...loungeEntries,
  ];
}
