import { headers } from "next/headers";
import { getAllAirportIatas } from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";
import { haversineKm } from "@/lib/geo";

export interface NearestAirport {
  iata: string;
  slug: string;
  city: string;
  name: string;
}

/** Beyond this, "nearest" stops being useful in the header. */
const MAX_DISTANCE_KM = 500;

function parseCoordinate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolves the visitor's nearest covered airport from Vercel's IP
 * geolocation headers. Reads `headers()`, so any caller must be rendered
 * inside a `<Suspense>` boundary under Cache Components.
 */
export async function getNearestAirportFromRequest(): Promise<NearestAirport | null> {
  const headerList = await headers();
  const latitude = parseCoordinate(headerList.get("x-vercel-ip-latitude"));
  const longitude = parseCoordinate(headerList.get("x-vercel-ip-longitude"));

  if (latitude === null || longitude === null) {
    return null;
  }

  const iatas = await getAllAirportIatas();

  let nearest: ReturnType<typeof getAirportByIata> | undefined;
  let nearestKm = Infinity;
  for (const iata of iatas) {
    const record = getAirportByIata(iata);
    if (!record) continue;
    const km = haversineKm(latitude, longitude, record.latitude, record.longitude);
    if (km < nearestKm) {
      nearestKm = km;
      nearest = record;
    }
  }

  if (!nearest || nearestKm > MAX_DISTANCE_KM) {
    return null;
  }

  return {
    iata: nearest.iata_code,
    slug: nearest.iata_code.toLowerCase(),
    city: nearest.city_name,
    name: nearest.name,
  };
}
