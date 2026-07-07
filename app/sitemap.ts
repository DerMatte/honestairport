import type { MetadataRoute } from "next";
import { getAirportContent, getAllAirportIatas } from "@/lib/airport-content";
import { getAirportSlugs } from "@/lib/airport-utils";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

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

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...airportEntries,
  ];
}
