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
  const [guides, scoredSlugs, lounges, imageUrls] = await Promise.all([
    getAllAirports(),
    getAirportSlugs(),
    getAllAirportLoungeParams(),
    getSitemapImageUrls(),
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

  const latestGuideUpdate = airportSlugs.reduce<Date | undefined>((latest, slug) => {
    const updated = validDate(guideBySlug.get(slug)?.lastUpdated);
    return updated && (!latest || updated > latest) ? updated : latest;
  }, undefined);

  const airportEntries = airportSlugs.flatMap((slug): MetadataRoute.Sitemap => {
    const lastModified = validDate(guideBySlug.get(slug)?.lastUpdated);
    const images = imageUrls.airports[slug.toUpperCase()] ?? [];
    const priority = scoredSlugSet.has(slug) ? 0.85 : 0.75;
    return [
      {
        url: `${SITE_URL}/airports/${slug}`,
        lastModified,
        changeFrequency: "monthly",
        priority,
        images,
      },
      {
        url: `${SITE_URL}/airports/${slug}.md`,
        lastModified,
        changeFrequency: "monthly",
        priority: priority - 0.05,
      },
    ];
  });

  const loungeEntries = sortedLounges.flatMap((lounge): MetadataRoute.Sitemap => {
    const iata = lounge.iata.toLowerCase();
    const lastModified = validDate(lounge.updatedAt);
    const images =
      imageUrls.lounges[`${lounge.iata.toUpperCase()}/${lounge.slug}`] ?? [];
    const html = `${SITE_URL}/airports/${iata}/lounge/${lounge.slug}`;
    return [
      {
        url: html,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.6,
        images,
      },
      {
        url: `${html}.md`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.55,
      },
    ];
  });

  return [
    {
      url: SITE_URL,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/index.md`,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/sitemap.md`,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/llms.txt`,
      lastModified: latestGuideUpdate,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/tsa-tips`,
      lastModified: new Date("2026-08-07"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/members`,
      lastModified: new Date("2026-08-29"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...airportEntries,
    ...loungeEntries,
  ];
}
