import { getAirportBySlug } from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";

export type AirportTeaser = {
  name: string;
  iata: string;
  city: string;
  country: string | null;
  blurb: string | null;
};

/**
 * Public snippet for the paywall. Name, city, and an existing 1–2 sentence
 * summary only — no scores, lounges, reviews, or guide body.
 */
export async function getAirportTeaser(slug: string): Promise<AirportTeaser | null> {
  const airport = await getAirportBySlug(slug);
  if (airport) {
    return {
      name: airport.name,
      iata: airport.iata,
      city: airport.city,
      country: airport.country,
      blurb: airport.summary || null,
    };
  }

  const record = getAirportByIata(slug);
  if (!record) {
    return null;
  }

  return {
    name: record.name,
    iata: record.iata_code,
    city: record.city_name,
    country: record.iata_country_code || null,
    blurb: null,
  };
}
