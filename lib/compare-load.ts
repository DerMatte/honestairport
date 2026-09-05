import {
  getAirportContent,
  getAirportLoungesWithFallback,
  getAirportProfile,
} from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";
import {
  identityFromAirport,
  identityFromFrontmatter,
  identityFromRecord,
  loungeVerdictCounts,
  scoresFromAirport,
  type CompareSideView,
} from "@/lib/compare-airports";
import type { CompareIataParam } from "@/lib/compare-search-params";

export async function loadCompareSide(
  param: CompareIataParam,
): Promise<CompareSideView> {
  switch (param.kind) {
    case "empty":
      return { status: "empty" };
    case "invalid":
      return { status: "invalid", raw: param.raw };
    case "ok":
      break;
    default: {
      const exhaustiveCheck: never = param;
      return exhaustiveCheck;
    }
  }

  const iata = param.iata;
  const [profile, guide, lounges] = await Promise.all([
    getAirportProfile(iata),
    getAirportContent(iata),
    getAirportLoungesWithFallback(iata),
  ]);
  const counts = loungeVerdictCounts(lounges);

  if (profile) {
    return {
      status: "scored",
      identity: identityFromAirport(profile),
      scores: scoresFromAirport(profile),
      lounges: counts,
    };
  }

  if (guide) {
    return {
      status: "unscored",
      identity: identityFromFrontmatter(guide.frontmatter),
      hasGuide: true,
      lounges: counts,
    };
  }

  const record = getAirportByIata(iata);
  if (record) {
    return {
      status: "unscored",
      identity: identityFromRecord(record),
      hasGuide: false,
      lounges: counts,
    };
  }

  return { status: "unknown", iata };
}
