import { NextResponse } from "next/server";
import { getAllAirportIatas } from "@/lib/airport-content";
import { getAirportByIata } from "@/lib/airports";

/** Beyond this, "nearest" stops being useful in the header. */
const MAX_DISTANCE_KM = 500;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
// Geo resolution is IP-based and coarse; an hour of client-side reuse is plenty.
const CACHE_HEADERS = { "Cache-Control": "private, max-age=3600" };

function parseCoordinate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  // Vercel resolves these from the visitor's IP on every request.
  const latitude = parseCoordinate(request.headers.get("x-vercel-ip-latitude"));
  const longitude = parseCoordinate(
    request.headers.get("x-vercel-ip-longitude"),
  );

  if (latitude === null || longitude === null) {
    return NextResponse.json(null, { headers: NO_STORE_HEADERS });
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
    return NextResponse.json(null, { headers: CACHE_HEADERS });
  }

  return NextResponse.json(
    {
      iata: nearest.iata_code,
      slug: nearest.iata_code.toLowerCase(),
      city: nearest.city_name,
      name: nearest.name,
    },
    { headers: CACHE_HEADERS },
  );
}
