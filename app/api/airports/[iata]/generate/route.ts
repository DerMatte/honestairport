import { checkBotId } from "botid/server";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { AIRPORT_GUIDES_CACHE_TAG } from "@/lib/airport-content";
import { isDatabaseConfigured } from "@/lib/db";
import { createAirportGuideStream } from "@/lib/generate-airport-guide";
import {
  airportGuideExists,
  parseAirportGuideMarkdown,
  upsertAirportGuide,
} from "@/lib/airport-guides";
import { getAirportByIata } from "@/lib/airports";

interface RouteParams {
  params: Promise<{ iata: string }>;
}

function normalizeIata(iata: string): string | null {
  const normalized = iata.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { iata } = await params;
  const normalized = normalizeIata(iata);

  if (!normalized) {
    return NextResponse.json({ error: "Invalid IATA code" }, { status: 400 });
  }

  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return NextResponse.json({ error: "Guide generation is not configured" }, { status: 503 });
  }

  const record = getAirportByIata(normalized);
  if (!record) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  if (await airportGuideExists(normalized)) {
    return NextResponse.json({ error: "Guide already exists", iata: normalized }, { status: 409 });
  }

  try {
    const result = createAirportGuideStream(normalized, record, "", {
      onFinish: async ({ text }) => {
        try {
          await upsertAirportGuide(parseAirportGuideMarkdown(text.trim()));
          revalidateTag(AIRPORT_GUIDES_CACHE_TAG, { expire: 0 });
        } catch (error) {
          console.error(`Failed to save generated guide for ${normalized}:`, error);
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-store",
        "X-Airport-IATA": normalized,
      },
    });
  } catch (error) {
    console.error(`Failed to start guide generation for ${normalized}:`, error);
    return NextResponse.json({ error: "Failed to start guide generation" }, { status: 500 });
  }
}