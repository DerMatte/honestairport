import { checkBotId } from "botid/server";
import { revalidateTag } from "next/cache";
import { NextResponse, after } from "next/server";
import { AIRPORT_GUIDES_CACHE_TAG, AIRPORT_PROFILES_CACHE_TAG } from "@/lib/airport-content";
import { isDatabaseConfigured } from "@/lib/db";
import { createAirportGuideStream } from "@/lib/generate-airport-guide";
import { generateAirportScoreProfile } from "@/lib/generate-airport-profile";
import { buildGuideSaveMarker } from "@/lib/airport-guide-markdown";
import {
  airportGuideExists,
  parseAirportGuideMarkdown,
  upsertAirportGuide,
} from "@/lib/airport-guides";
import { upsertAirportProfile } from "@/lib/airport-profiles";
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
    const result = createAirportGuideStream(normalized, record, "");
    const encoder = new TextEncoder();

    // Resolved by the stream below with the saved guide markdown, or null on
    // any failure path, so the scoring step in `after` always settles.
    let resolveSavedGuide!: (guideMarkdown: string | null) => void;
    const savedGuide = new Promise<string | null>((resolve) => {
      resolveSavedGuide = resolve;
    });

    // Every generated guide also gets an Airportist Score so it never gets
    // stuck as an editorial-only page. Scoring is a second model call that
    // takes minutes, so it runs in `after` — the response stream closes as
    // soon as the guide is saved and the client refreshes immediately, while
    // the function stays alive to finish scoring. Best-effort: a scoring
    // failure just leaves the airport guide-only until the VPS grok cron
    // re-scores it.
    after(async () => {
      const guideMarkdown = await savedGuide;
      if (!guideMarkdown) {
        return;
      }

      try {
        const profileInput = await generateAirportScoreProfile(normalized, record, guideMarkdown);
        await upsertAirportProfile(normalized, profileInput);
        revalidateTag(AIRPORT_PROFILES_CACHE_TAG, { expire: 0 });
      } catch (error) {
        console.error(`Failed to generate Airportist Score for ${normalized}:`, error);
      }
    });

    // Built by hand instead of `result.toTextStreamResponse()` so we can keep
    // reading `result.textStream` to completion and append a definitive
    // save-outcome marker, even if the client disconnects (tab closed,
    // navigated away) before generation finishes. Without that, a dropped
    // connection means the guide is fully researched but never persisted.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function safeEnqueue(chunk: string) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Client is gone; keep going so the guide still gets saved below.
          }
        }

        let text = "";
        try {
          for await (const chunk of result.textStream) {
            text += chunk;
            safeEnqueue(chunk);
          }
        } catch (error) {
          console.error(`Guide generation stream failed for ${normalized}:`, error);
          resolveSavedGuide(null);
          safeEnqueue(
            buildGuideSaveMarker({
              status: "error",
              message: "Generation failed while streaming. Please try again.",
            }),
          );
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        try {
          const trimmedGuide = text.trim();
          await upsertAirportGuide(parseAirportGuideMarkdown(trimmedGuide));
          revalidateTag(AIRPORT_GUIDES_CACHE_TAG, { expire: 0 });
          safeEnqueue(buildGuideSaveMarker({ status: "ok" }));
          resolveSavedGuide(trimmedGuide);
        } catch (error) {
          console.error(`Failed to save generated guide for ${normalized}:`, error);
          resolveSavedGuide(null);
          safeEnqueue(
            buildGuideSaveMarker({
              status: "error",
              message: "This guide didn't pass our quality checks. Please try again.",
            }),
          );
        }

        try {
          controller.close();
        } catch {
          // already closed
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Airport-IATA": normalized,
      },
    });
  } catch (error) {
    console.error(`Failed to start guide generation for ${normalized}:`, error);
    return NextResponse.json({ error: "Failed to start guide generation" }, { status: 500 });
  }
}