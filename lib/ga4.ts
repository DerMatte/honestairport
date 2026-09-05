/**
 * GA4 browser helpers + Measurement Protocol.
 * Browser gtag is on when NEXT_PUBLIC_GA4_MEASUREMENT_ID is set.
 * Server collect no-ops unless a measurement id and GA4_API_SECRET are set.
 * Tests inject `fetchImpl` so CI never hits google-analytics.com.
 */

import {
  getGa4ApiSecret,
  getGa4MeasurementId,
  isGa4MeasurementProtocolEnabled,
  MEMBER_CONTENT_NAME,
  MEMBER_PLAN_ID,
  MEMBER_SUBSCRIBE_CURRENCY,
  MEMBER_SUBSCRIBE_VALUE,
} from "@/lib/meta-tracking";
import type { WhopEnv } from "@/lib/whop-gate";

export type Ga4EventParams = {
  value?: number;
  currency?: string;
  transaction_id?: string;
  item_name?: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
  engagement_time_msec?: number;
};

export type Ga4Event = {
  name: "purchase" | "subscribe";
  params: Ga4EventParams;
};

export type Ga4CollectPayload = {
  client_id: string;
  user_id?: string;
  timestamp_micros?: number;
  events: Ga4Event[];
};

export type SendGa4Result =
  | { ok: true; skipped: "ga4_off" | "empty" }
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export function ga4ClientIdFromActivation(options: {
  eventId: string;
  userId?: string | null;
}): string {
  const seed = options.userId?.trim() || options.eventId.trim();
  return `ha.${seed}`;
}

export function memberGa4Item() {
  return {
    item_id: MEMBER_PLAN_ID,
    item_name: MEMBER_CONTENT_NAME,
    price: MEMBER_SUBSCRIBE_VALUE,
    quantity: 1,
  };
}

export function buildGa4ActivationEvents(options: {
  eventId: string;
  userId?: string | null;
  eventTimeSec?: number;
}): Ga4CollectPayload {
  const transactionId = options.eventId;
  const shared: Ga4EventParams = {
    value: MEMBER_SUBSCRIBE_VALUE,
    currency: MEMBER_SUBSCRIBE_CURRENCY,
    transaction_id: transactionId,
    item_name: MEMBER_CONTENT_NAME,
    items: [memberGa4Item()],
    engagement_time_msec: 100,
  };
  const payload: Ga4CollectPayload = {
    client_id: ga4ClientIdFromActivation({
      eventId: options.eventId,
      userId: options.userId,
    }),
    events: [
      { name: "purchase", params: { ...shared } },
      { name: "subscribe", params: { ...shared } },
    ],
  };
  const userId = options.userId?.trim();
  if (userId) {
    payload.user_id = userId;
  }
  if (options.eventTimeSec != null) {
    payload.timestamp_micros = options.eventTimeSec * 1_000_000;
  }
  return payload;
}

export async function sendGa4MeasurementProtocol(
  payload: Ga4CollectPayload,
  options: {
    env?: WhopEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SendGa4Result> {
  const env = options.env ?? process.env;
  if (!isGa4MeasurementProtocolEnabled(env)) {
    return { ok: true, skipped: "ga4_off" };
  }
  if (payload.events.length === 0) {
    return { ok: true, skipped: "empty" };
  }

  const measurementId = getGa4MeasurementId(env);
  const apiSecret = getGa4ApiSecret(env);
  if (!measurementId || !apiSecret) {
    return { ok: true, skipped: "ga4_off" };
  }

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: "ga4_http" };
    }
    return { ok: true, status: response.status };
  } catch {
    return { ok: false, error: "ga4_network" };
  }
}
