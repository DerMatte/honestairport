import {
  getAllAirportLoungeParams,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import { buildLlmsTxt, markdownResponse } from "@/lib/page-markdown";

/** Discovery file for AI agents: points at markdown entry points and URL patterns. */
export async function GET() {
  const [scored, guides, lounges] = await Promise.all([
    getAllHonestAirports(),
    getAllAirports(),
    getAllAirportLoungeParams(),
  ]);

  return markdownResponse(
    buildLlmsTxt({
      scoredCount: scored.length,
      guideCount: guides.length,
      loungeCount: lounges.length,
    }),
    { contentType: "text/plain; charset=utf-8" },
  );
}
