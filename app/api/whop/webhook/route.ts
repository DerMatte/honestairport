import { after } from "next/server";
import { sendGa4MeasurementProtocol } from "@/lib/ga4";
import { sendMetaCapiEvents } from "@/lib/meta-capi";
import { handleWhopWebhook } from "@/lib/whop-webhook";

/**
 * Whop → HonestAirport Members activation.
 *
 * Meta CAPI: Subscribe (ads primary) + Purchase, same event_id.
 * GA4 MP:    purchase + subscribe when GA4_API_SECRET is set.
 *
 * Dashboard:
 *   URL:    https://www.honestairport.com/api/whop/webhook
 *   Events: payment.succeeded, membership.activated
 *   Secret: store as WHOP_WEBHOOK_SECRET (leave empty = this route 404s)
 *
 * Unlock via receipt (`/api/whop/unlock`) is not Meta/GA4 attribution.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = handleWhopWebhook({
    rawBody,
    headers: request.headers,
  });

  if (result.capiEvents.length > 0 || result.ga4) {
    const capiEvents = result.capiEvents;
    const ga4 = result.ga4;
    after(async () => {
      const [capi, measurement] = await Promise.all([
        capiEvents.length > 0
          ? sendMetaCapiEvents(capiEvents)
          : Promise.resolve({ ok: true as const, skipped: "empty" as const }),
        ga4
          ? sendGa4MeasurementProtocol(ga4)
          : Promise.resolve({ ok: true as const, skipped: "empty" as const }),
      ]);
      if (!capi.ok) {
        console.error("[whop-webhook] capi_failed", capi.error);
      }
      if (!measurement.ok) {
        console.error("[whop-webhook] ga4_failed", measurement.error);
      }
    });
  }

  return Response.json(result.body, { status: result.status });
}
