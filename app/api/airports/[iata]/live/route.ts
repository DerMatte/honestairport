import { NextResponse } from "next/server";
import { getAirportLiveData } from "@/lib/airport-live-data";

interface RouteParams {
  params: Promise<{ iata: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { iata } = await params;
  const normalized = iata.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid IATA code" }, { status: 400 });
  }

  const data = await getAirportLiveData(normalized);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
