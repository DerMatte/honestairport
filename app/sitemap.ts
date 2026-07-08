import type { MetadataRoute } from "next";
import { getAirportContent, getAllAirportIatas } from "@/lib/airport-content";
import { getAirportSlugs } from "@/lib/airport-utils";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guideIatas = await getAllAirportIatas();
  const slugs = new Set([
    ...getAirportSlugs(),
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
