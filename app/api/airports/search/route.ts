import { NextResponse } from "next/server";
import { searchAirports, type AirportLocationFilter } from "@/lib/airport-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 100);

  const city = searchParams.get("city");
  const country = searchParams.get("country");
  const location: AirportLocationFilter | undefined = city
    ? { field: "city", value: city }
    : country
      ? { field: "country", value: country }
      : undefined;

  const results = await searchAirports(query, location);

  return NextResponse.json(results, {
    headers: {
      // Same effective freshness as the underlying cached entry list; keeps
      // repeated keystrokes across visitors off the function entirely.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
