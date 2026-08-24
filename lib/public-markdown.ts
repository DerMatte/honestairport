/**
 * Shared loaders for the public airport/lounge markdown pages.
 *
 * Used by `/md/...` (the `*.md` URLs) and by the MCP tools so both surfaces
 * return the same document without scraping HTML.
 */
import {
  getAirportBySlug,
  getAirportContent,
  getAirportGoogleRating,
  getAirportLounge,
  getAirportLounges,
  getAirportLoungesWithFallback,
  getEditorialReviews,
  resolveAirportDisplayName,
} from "@/lib/airport-content";
import {
  buildAirportPageMarkdown,
  buildLoungePageMarkdown,
} from "@/lib/page-markdown";

export async function loadAirportPageMarkdown(
  slug: string,
): Promise<string | null> {
  const iata = slug.trim().toUpperCase();
  const [profile, guide, googleRating, lounges, reviews] = await Promise.all([
    getAirportBySlug(slug),
    getAirportContent(slug),
    getAirportGoogleRating(iata),
    getAirportLoungesWithFallback(iata),
    getEditorialReviews(iata),
  ]);

  return buildAirportPageMarkdown({
    slug: slug.trim().toLowerCase(),
    profile,
    guide,
    googleRating,
    lounges,
    reviews,
  });
}

export async function loadLoungePageMarkdown(
  slug: string,
  loungeSlug: string,
): Promise<string | null> {
  const iata = slug.trim().toUpperCase();
  const [lounge, airportName, airportLounges] = await Promise.all([
    getAirportLounge(iata, loungeSlug),
    resolveAirportDisplayName(slug),
    getAirportLounges(iata),
  ]);

  if (!lounge) {
    return null;
  }

  return buildLoungePageMarkdown({
    slug: slug.trim().toLowerCase(),
    loungeSlug,
    lounge,
    airportName: airportName ?? iata,
    otherLounges: airportLounges,
  });
}
