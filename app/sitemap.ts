import type { MetadataRoute } from "next";
import {
  getAirportSlugs,
  getAllAirportLoungeParams,
  getAllAirports,
  getSitemapImageUrls,
} from "@/lib/airport-content";
import { SITE_URL } from "@/lib/site";

function validDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guides, scoredSlugs, lounges] = await Promise.all([
    getAllAirports(),
    getAirportSlugs(),
    getAllAirportLoungeParams(),
  ]);

  const guideBySlug = new Map(
    guides.map((guide) => [guide.iata.toLowerCase(), guide]),
  );
  const scoredSlugSet = new Set(scoredSlugs.map((slug) => slug.toLowerCase()));
  const airportSlugs = [
    ...new Set([
      ...guides.map((guide) => guide.iata.toLowerCase()),
      ...scoredSlugs.map((slug) => slug.toLowerCase()),
    ]),
  ].sort();
  const sortedLounges = [...lounges].sort(
    (a, b) =>
      a.iata.localeCompare(b.iata) || a.slug.localeCompare(b.slug),
  );

  const imageUrls = await getSitemapImageUrls();

  const airportEntries = airportSlugs.map(
    (slug): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/airports/${slug}`,
      lastModified: validDate(guideBySlug.get(slug)?.lastUpdated),
      changeFrequency: "monthly",
      priority: scoredSlugSet.has(slug) ? 0.85 : 0.75,
      images: imageUrls.airports[slug.toUpperCase()] ?? [],
    }),
  );

  const loungeEntries = sortedLounges.map(
    (lounge): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/airports/${lounge.iata.toLowerCase()}/lounge/${lounge.slug}`,
      lastModified: validDate(lounge.updatedAt),
      changeFrequency: "monthly",
      priority: 0.6,
      images: imageUrls.lounges[`${lounge.iata.toUpperCase()}/${lounge.slug}`] ?? [],
    }),
  );

  const latestGuideUpdate = airportEntries.reduce<Date | undefined>(
    (latest, entry) => {
      const updated = validDate(entry.lastModified);
      return updated && (!latest || updated > latest) ? updated : latest;
    },
    undefined,
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
