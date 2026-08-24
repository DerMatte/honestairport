import { NextRequest } from "next/server";
import {
  AIRPORT_GOOGLE_RATINGS_CACHE_TAG,
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_LOUNGES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
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
  resolveAirportDisplayName,
} from "@/lib/airport-content";
import { isAirportTabMarkdownSlug } from "@/lib/airport-tabs";
import {
  buildAirportPageMarkdown,
  buildAirportTabMarkdown,
  buildHomeMarkdown,
  buildLoungePageMarkdown,
  buildSitemapMarkdown,
  markdownResponse,
} from "@/lib/page-markdown";
import { hasLiveWhopMembership } from "@/lib/whop-access";
import { handleMarkdownWithOptionalPayment, isPaidMarkdownSegments } from "@/lib/x402";

interface MdRouteProps {
  params: Promise<{ path?: string[] }>;
}

const HOME_CACHE_TAGS = [AIRPORT_GUIDES_CACHE_TAG, AIRPORT_PROFILES_CACHE_TAG];
const AIRPORT_CACHE_TAGS = [
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  AIRPORT_GOOGLE_RATINGS_CACHE_TAG,
  AIRPORT_LOUNGES_CACHE_TAG,
];
const LOUNGE_CACHE_TAGS = [AIRPORT_LOUNGES_CACHE_TAG, AIRPORT_GUIDES_CACHE_TAG];
const SITEMAP_CACHE_TAGS = [
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  AIRPORT_LOUNGES_CACHE_TAG,
];

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

async function serveMarkdown(path: string[]): Promise<Response> {
  if (path.length === 0 || (path.length === 1 && path[0] === "index")) {
    return markdownResponse(await homeMarkdown(), {
      cacheTags: HOME_CACHE_TAGS,
      canonicalPath: "/index.md",
    });
  }

  if (path.length === 1 && path[0] === "sitemap") {
    return markdownResponse(await sitemapMarkdown(), {
      cacheTags: SITEMAP_CACHE_TAGS,
      canonicalPath: "/sitemap.md",
    });
  }

  if (path.length === 2 && path[0] === "airports") {
    const slug = path[1].toLowerCase();
    const body = await airportMarkdown(slug);
    if (!body) {
      return markdownResponse("Not found\n", {
        status: 404,
        contentType: "text/plain; charset=utf-8",
      });
    }
    return markdownResponse(body, {
      cacheTags: AIRPORT_CACHE_TAGS,
      canonicalPath: `/airports/${slug}.md`,
    });
  }

  if (
    path.length === 3 &&
    path[0] === "airports" &&
    isAirportTabMarkdownSlug(path[2])
  ) {
    const slug = path[1].toLowerCase();
    const tab = path[2];
    const iata = slug.trim().toUpperCase();
    const [profile, guide, lounges, reviews] = await Promise.all([
      getAirportBySlug(slug),
      getAirportContent(slug),
      getAirportLoungesWithFallback(iata),
      getEditorialReviews(iata),
    ]);
    const body = buildAirportTabMarkdown({
      slug,
      tab,
      profile,
      guide,
      lounges,
      reviews,
    });
    if (!body) {
      return markdownResponse("Not found\n", {
        status: 404,
        contentType: "text/plain; charset=utf-8",
      });
    }
    return markdownResponse(body, {
      cacheTags: AIRPORT_CACHE_TAGS,
      canonicalPath: `/airports/${slug}/${tab}.md`,
    });
  }

  if (
    path.length === 4 &&
    path[0] === "airports" &&
    path[2] === "lounge"
  ) {
    const slug = path[1].toLowerCase();
    const loungeSlug = path[3];
    const body = await loungeMarkdown(slug, loungeSlug);
    if (!body) {
      return markdownResponse("Not found\n", {
        status: 404,
        contentType: "text/plain; charset=utf-8",
      });
    }
    return markdownResponse(body, {
      cacheTags: LOUNGE_CACHE_TAGS,
      canonicalPath: `/airports/${slug}/lounge/${loungeSlug}.md`,
    });
  }

  return markdownResponse("Not found\n", {
    status: 404,
    contentType: "text/plain; charset=utf-8",
  });
}

export async function GET(request: NextRequest, { params }: MdRouteProps) {
  const { path = [] } = await params;
  const memberBypass =
    isPaidMarkdownSegments(path) && (await hasLiveWhopMembership());
  return handleMarkdownWithOptionalPayment(request, path, () =>
    serveMarkdown(path),
    { grantAccessWithoutPayment: memberBypass },
  );
}
