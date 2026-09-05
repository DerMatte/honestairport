import { after } from "next/server";
import { sendMetaCapiEvents } from "@/lib/meta-capi";
import { handleWhopWebhook } from "@/lib/whop-webhook";

/**
 * Whop → HonestAirport Members Subscribe (Meta CAPI).
 *
 * Dashboard:
 *   URL:    https://www.honestairport.com/api/whop/webhook
 *   Events: payment.succeeded, membership.activated
 *   Secret: store as WHOP_WEBHOOK_SECRET (leave empty = this route 404s)
 *
 * Unlock via receipt (`/api/whop/unlock`) is not Meta attribution.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = handleWhopWebhook({
    rawBody,
    headers: request.headers,
  });

  if (result.subscribe) {
    const event = result.subscribe;
    after(async () => {
      const sent = await sendMetaCapiEvents([event]);
      if (!sent.ok) {
        console.error("[whop-webhook] capi_failed", sent.error);
      }
    });
  }

  return Response.json(result.body, { status: result.status });
}
