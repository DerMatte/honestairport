import { notFound } from "next/navigation";
import {
  getAirportBySlug,
  getAirportContent,
  getAirportGoogleRating,
  getAirportLounge,
  getAirportLounges,
  getAirportLoungesWithFallback,
  getAllAirportLoungeParams,
  getAllAirports,
  getAllHonestAirports,
  getEditorialReviews,
} from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";
import {
  buildAirportPageMarkdown,
  buildHomeMarkdown,
  buildLoungePageMarkdown,
  buildSitemapMarkdown,
  markdownResponse,
} from "@/lib/page-markdown";

interface MdRouteProps {
  params: Promise<{ path?: string[] }>;
}

async function resolveAirportName(slug: string): Promise<string | null> {
  const profile = await getAirportBySlug(slug);
  if (profile) {
    return profile.shortName;
  }

  const guide = await getAirportContent(slug);
  if (guide) {
    return guide.frontmatter.name;
  }

  return getAirportByIata(slug)?.name ?? null;
}

async function homeMarkdown(): Promise<string> {
  const [scored, guides] = await Promise.all([
    getAllHonestAirports(),
    getAllAirports(),
  ]);
  return buildHomeMarkdown({ scored, guides });
}

async function sitemapMarkdown(): Promise<string> {
  const [scored, guides, lounges] = await Promise.all([
    getAllHonestAirports(),
    getAllAirports(),
    getAllAirportLoungeParams(),
  ]);
  return buildSitemapMarkdown({ scored, guides, lounges });
}

async function airportMarkdown(slug: string): Promise<string | null> {
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

async function loungeMarkdown(
  slug: string,
  loungeSlug: string,
): Promise<string | null> {
  const iata = slug.trim().toUpperCase();
  const [lounge, airportName, airportLounges] = await Promise.all([
    getAirportLounge(iata, loungeSlug),
    resolveAirportName(slug),
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

export async function GET(_request: Request, { params }: MdRouteProps) {
  const { path = [] } = await params;

  if (path.length === 0 || (path.length === 1 && path[0] === "index")) {
    return markdownResponse(await homeMarkdown());
  }

  if (path.length === 1 && path[0] === "sitemap") {
    return markdownResponse(await sitemapMarkdown());
  }

  if (path.length === 2 && path[0] === "airports") {
    const body = await airportMarkdown(path[1]);
    if (!body) {
      notFound();
    }
    return markdownResponse(body);
  }

  if (
    path.length === 4 &&
    path[0] === "airports" &&
    path[2] === "lounge"
  ) {
    const body = await loungeMarkdown(path[1], path[3]);
    if (!body) {
      notFound();
    }
    return markdownResponse(body);
  }

  notFound();
}
