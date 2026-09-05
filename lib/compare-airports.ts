import type { AirportLoungeVerdict } from "./airport-guides";
import type { AirportRecord } from "./airports";
import type { Airport, AirportScoreBreakdown, DisruptionStatus } from "./types";

export const SCORE_BREAKDOWN_ROWS = [
  { key: "comfort", label: "Comfort" },
  { key: "navigation", label: "Navigation" },
  { key: "food", label: "Food" },
  { key: "transport", label: "Transport" },
  { key: "disruptionResilience", label: "Disruption resilience" },
] as const satisfies ReadonlyArray<{
  key: keyof AirportScoreBreakdown;
  label: string;
}>;

export type LoungeVerdictCounts = {
  total: number;
  worthIt: number;
  depends: number;
  skip: number;
  unlabeled: number;
};

export type CompareIdentity = {
  iata: string;
  slug: string;
  name: string;
  city: string;
  country: string;
};

export type CompareScoreSnapshot = {
  airportistScore: number;
  scoreBreakdown: AirportScoreBreakdown;
  summary: string;
  bestFor: string[];
  watchOutFor: string[];
  disruptionStatus: DisruptionStatus;
};

export type CompareSideView =
  | { status: "empty" }
  | { status: "invalid"; raw: string }
  | { status: "unknown"; iata: string }
  | {
      status: "unscored";
      identity: CompareIdentity;
      hasGuide: boolean;
      lounges: LoungeVerdictCounts;
    }
  | {
      status: "scored";
      identity: CompareIdentity;
      scores: CompareScoreSnapshot;
      lounges: LoungeVerdictCounts;
    };

export function loungeVerdictCounts(
  lounges: ReadonlyArray<{ verdict?: AirportLoungeVerdict | null }>,
): LoungeVerdictCounts {
  const counts: LoungeVerdictCounts = {
    total: lounges.length,
    worthIt: 0,
    depends: 0,
    skip: 0,
    unlabeled: 0,
  };

  for (const lounge of lounges) {
    switch (lounge.verdict) {
      case "worth-it":
        counts.worthIt += 1;
        break;
      case "depends":
        counts.depends += 1;
        break;
      case "skip":
        counts.skip += 1;
        break;
      case undefined:
      case null:
        counts.unlabeled += 1;
        break;
      default: {
        const exhaustiveCheck: never = lounge.verdict;
        void exhaustiveCheck;
        counts.unlabeled += 1;
      }
    }
  }

  return counts;
}

export function identityFromAirport(
  airport: Pick<Airport, "iata" | "slug" | "name" | "city" | "country">,
): CompareIdentity {
  return {
    iata: airport.iata.toUpperCase(),
    slug: airport.slug.toLowerCase(),
    name: airport.name,
    city: airport.city,
    country: airport.country,
  };
}

export function identityFromRecord(record: AirportRecord): CompareIdentity {
  return {
    iata: record.iata_code.toUpperCase(),
    slug: record.iata_code.toLowerCase(),
    name: record.name,
    city: record.city?.trim() || record.city_name,
    country: record.iata_country_code,
  };
}

export function identityFromFrontmatter(frontmatter: {
  iata: string;
  name: string;
  city: string;
  country: string;
}): CompareIdentity {
  return {
    iata: frontmatter.iata.toUpperCase(),
    slug: frontmatter.iata.toLowerCase(),
    name: frontmatter.name,
    city: frontmatter.city,
    country: frontmatter.country,
  };
}

export function scoresFromAirport(airport: Airport): CompareScoreSnapshot {
  return {
    airportistScore: airport.airportistScore,
    scoreBreakdown: airport.scoreBreakdown,
    summary: airport.summary,
    bestFor: airport.bestFor,
    watchOutFor: airport.watchOutFor,
    disruptionStatus: airport.disruption.status,
  };
}

export function compareSideIdentity(
  side: CompareSideView,
): CompareIdentity | null {
  if (side.status === "scored" || side.status === "unscored") {
    return side.identity;
  }
  return null;
}

export function compareSideIata(side: CompareSideView): string | null {
  switch (side.status) {
    case "empty":
      return null;
    case "invalid":
      return null;
    case "unknown":
      return side.iata;
    case "unscored":
    case "scored":
      return side.identity.iata;
    default: {
      const exhaustiveCheck: never = side;
      return exhaustiveCheck;
    }
  }
}

/** Higher scores win. Missing values never beat a real number. */
export function compareScoreWinner(
  a: number | undefined,
  b: number | undefined,
): "a" | "b" | "tie" | "none" {
  if (a == null && b == null) return "none";
  if (a == null) return "b";
  if (b == null) return "a";
  if (a === b) return "tie";
  return a > b ? "a" : "b";
}

export function formatLoungeHighlight(counts: LoungeVerdictCounts): string {
  if (counts.total === 0) {
    return "No lounge directory yet";
  }

  const mix = [
    counts.worthIt > 0 ? `${counts.worthIt} worth-it` : null,
    counts.depends > 0 ? `${counts.depends} depends` : null,
    counts.skip > 0 ? `${counts.skip} skip` : null,
  ].filter((part): part is string => part !== null);

  const noun = counts.total === 1 ? "lounge" : "lounges";
  if (mix.length === 0) {
    return `${counts.total} ${noun}`;
  }
  return `${counts.total} ${noun} · ${mix.join(" · ")}`;
}
