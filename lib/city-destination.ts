import cityCentersJson from "@/lib/data/city-centers.json";
import type { AirportRecord } from "@/lib/airports";
import { haversineKm } from "@/lib/geo";

/** Compact city-center rows: [latitude, longitude, name]. */
type CityCenterTuple = readonly [number, number, string];

const CITY_CENTERS = cityCentersJson as unknown as Record<string, CityCenterTuple>;

export interface CityDestination {
  /** IATA city code when known (e.g. NYC, LON). */
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Great-circle km from the airport to the city center. */
  distanceKm: number;
}

/**
 * Resolve the city-center dropoff for an airport using the IATA city code
 * mapped against a Travelpayouts-derived centers table. Returns null when the
 * city code is missing from that table (rare private strips).
 */
export function getCityDestination(airport: AirportRecord): CityDestination | null {
  const code = airport.iata_city_code?.trim().toUpperCase();
  if (!code) return null;

  const row = CITY_CENTERS[code];
  if (!row) return null;

  const [latitude, longitude, name] = row;
  return {
    code,
    name: name || airport.city_name,
    latitude,
    longitude,
    distanceKm: haversineKm(airport.latitude, airport.longitude, latitude, longitude),
  };
}
