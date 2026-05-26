import type { AirportSummary } from "@/lib/airport-content";

export function filterAirports(airports: AirportSummary[], query: string): AirportSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return airports;

  return airports.filter((airport) => {
    const haystack = [airport.iata, airport.name, airport.city, airport.country]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
