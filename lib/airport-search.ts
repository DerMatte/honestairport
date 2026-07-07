import { getAllAirports } from "@/lib/airport-content";
import { getAllHonestAirports } from "@/lib/airport-utils";

export interface AirportSearchEntry {
  slug: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  /** Airportist Score, only present for fully scored airports. */
  score?: number;
}

/**
 * Merges the scored MVP airports with every markdown guide so site-wide
 * search covers all airports, not just the seeded ten.
 */
export async function getAirportSearchEntries(): Promise<AirportSearchEntry[]> {
  const scored = getAllHonestAirports();
  const guides = await getAllAirports();

  const entries = new Map<string, AirportSearchEntry>();

  for (const guide of guides) {
    const slug = guide.iata.toLowerCase();
    entries.set(slug, {
      slug,
      iata: guide.iata,
      name: guide.name,
      city: guide.city,
      country: guide.country,
    });
  }

  for (const airport of scored) {
    entries.set(airport.slug, {
      slug: airport.slug,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      score: airport.airportistScore,
    });
  }

  return [...entries.values()].sort((a, b) => {
    if (a.score !== undefined || b.score !== undefined) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return a.name.localeCompare(b.name);
  });
}
