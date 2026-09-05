/**
 * Whop webhook verification + HonestAirport Members Subscribe mapping.
 *
 * Installed `@whop/sdk` 0.0.42 unwraps via `standardwebhooks`:
 * HMAC-SHA256 of `{webhook-id}.{webhook-timestamp}.{raw body}`,
 * `v1,<base64>` in `webhook-signature`, 5-minute timestamp window.
 *
 * Current Whop docs also issue `ws_…` secrets and say the HMAC key is
 * that string as-is (not base64-decoded). We accept both:
 *   - `whsec_…` → Standard Webhooks (strip prefix, base64-decode)
 *   - `ws_…`    → HMAC key is the full secret UTF-8 bytes
 *   - other     → try Standard Webhooks decode, then raw UTF-8
 *
 * Activation fires Subscribe + Purchase (same event_id) for
 * `payment.succeeded` / `membership.activated` when the payload product
 * is `prod_F5F5XD1OGhQoK` or the plan is `plan_ee0kSfuyD6v9a`
 * (or the env product/plan override). GA4 purchase + subscribe go out
 * on the same activation when Measurement Protocol env is set.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getWhopWebhookSecret,
  MEMBER_PLAN_ID,
  activationEventIdFromWhopId,
} from "@/lib/meta-tracking";
import {
  buildActivationCapiEvents,
  userDataFromRequest,
  type MetaCapiEvent,
} from "@/lib/meta-capi";
import { buildGa4ActivationEvents, type Ga4CollectPayload } from "@/lib/ga4";
import {
  DEFAULT_WHOP_PRODUCT_ID,
  getWhopProductId,
  type WhopEnv,
} from "@/lib/whop-gate";

export const WHOP_WEBHOOK_TOLERANCE_SEC = 5 * 60;

export const WHOP_SUBSCRIBE_EVENT_TYPES = [
  "payment.succeeded",
  "membership.activated",
] as const;

export type WhopSubscribeEventType = (typeof WHOP_SUBSCRIBE_EVENT_TYPES)[number];

export type WhopWebhookData = {
  id?: string;
  product?: { id?: string | null } | null;
  plan?: { id?: string | null } | null;
  user?: { id?: string | null; email?: string | null } | null;
  membership?: { id?: string | null } | null;
};

export type WhopWebhookEnvelope = {
  id?: string;
  type?: string;
  timestamp?: string;
  data?: WhopWebhookData | null;
};

export type VerifyWhopWebhookResult =
  | { ok: true; event: WhopWebhookEnvelope }
  | { ok: false; error: "missing_headers" | "bad_timestamp" | "bad_signature" | "bad_json" };

function headerMap(headers: Headers | Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function hmacBase64(key: Buffer, signedContent: string): string {
  return createHmac("sha256", key).update(signedContent).digest("base64");
}

function signaturesMatch(expectedB64: string, providedB64: string): boolean {
  const a = Buffer.from(expectedB64);
  const b = Buffer.from(providedB64);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function candidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = [];
  if (secret.startsWith("whsec_")) {
    try {
      keys.push(Buffer.from(secret.slice("whsec_".length), "base64"));
    } catch {
      // ignore malformed standard-webhooks secret
    }
    return keys;
  }
  if (secret.startsWith("ws_")) {
    keys.push(Buffer.from(secret, "utf8"));
    return keys;
  }
  try {
    keys.push(Buffer.from(secret, "base64"));
  } catch {
    // ignore
  }
  keys.push(Buffer.from(secret, "utf8"));
  return keys.filter((key) => key.length > 0);
}

/** Test helper: Standard Webhooks (`whsec_`) signature for a body. */
export function signWhopWebhook(
  secret: string,
  webhookId: string,
  timestampSec: number,
  body: string,
): string {
  const keys = candidateKeys(secret);
  const signed = `${webhookId}.${timestampSec}.${body}`;
  return `v1,${hmacBase64(keys[0] ?? Buffer.from(secret, "utf8"), signed)}`;
}

export function verifyWhopWebhookSignature(options: {
  rawBody: string;
  headers: Headers | Record<string, string>;
  secret: string;
  nowSec?: number;
}): VerifyWhopWebhookResult {
  const headers = headerMap(options.headers);
  const webhookId = headers["webhook-id"]?.trim();
  const timestamp = headers["webhook-timestamp"]?.trim();
  const signatureHeader = headers["webhook-signature"]?.trim();

  if (!webhookId || !timestamp || !signatureHeader) {
    return { ok: false, error: "missing_headers" };
  }

  const timestampSec = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSec)) {
    return { ok: false, error: "bad_timestamp" };
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > WHOP_WEBHOOK_TOLERANCE_SEC) {
    return { ok: false, error: "bad_timestamp" };
  }

  const signedContent = `${webhookId}.${timestampSec}.${options.rawBody}`;
  const provided = signatureHeader.split(/\s+/).flatMap((part) => {
    const [version, sig] = part.split(",", 2);
    return version === "v1" && sig ? [sig] : [];
  });
  if (provided.length === 0) {
    return { ok: false, error: "bad_signature" };
  }

  const expected = candidateKeys(options.secret).map((key) =>
    hmacBase64(key, signedContent),
  );
  const matched = expected.some((exp) =>
    provided.some((sig) => signaturesMatch(exp, sig)),
  );
  if (!matched) {
    return { ok: false, error: "bad_signature" };
  }

  try {
    const parsed: unknown = JSON.parse(options.rawBody);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "bad_json" };
    }
    return { ok: true, event: parsed as WhopWebhookEnvelope };
  } catch {
    return { ok: false, error: "bad_json" };
  }
}

export function isWhopSubscribeEventType(
  type: string | undefined,
): type is WhopSubscribeEventType {
  return (
    type === "payment.succeeded" || type === "membership.activated"
  );
}

export function matchesHonestAirportMembership(
  data: WhopWebhookData | null | undefined,
  env: WhopEnv = process.env,
): boolean {
  if (!data) {
    return false;
  }
  const productId = getWhopProductId(env) ?? DEFAULT_WHOP_PRODUCT_ID;
  const planId = env.WHOP_PLAN_ID?.trim() || MEMBER_PLAN_ID;
  const payloadProduct = data.product?.id?.trim();
  const payloadPlan = data.plan?.id?.trim();
  return payloadProduct === productId || payloadPlan === planId;
}

export function subscribeEventIdForWebhook(
  event: WhopWebhookEnvelope,
): string | null {
  const data = event.data;
  if (!data) {
    return null;
  }
  if (event.type === "payment.succeeded" && data.id?.trim()) {
    return activationEventIdFromWhopId(data.id);
  }
  if (event.type === "membership.activated" && data.id?.trim()) {
    return activationEventIdFromWhopId(data.id);
  }
  const fallback = data.membership?.id?.trim() || data.id?.trim();
  return fallback ? activationEventIdFromWhopId(fallback) : null;
}

export function eventTimeFromWebhook(event: WhopWebhookEnvelope, nowSec?: number): number {
  if (event.timestamp) {
    const parsed = Date.parse(event.timestamp);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return nowSec ?? Math.floor(Date.now() / 1000);
}

export type ActivationEvents = {
  eventId: string;
  capi: [MetaCapiEvent, MetaCapiEvent];
  ga4: Ga4CollectPayload;
};

export function buildActivationEventsFromWebhook(
  event: WhopWebhookEnvelope,
  env: WhopEnv = process.env,
  nowSec?: number,
): ActivationEvents | null {
  if (!isWhopSubscribeEventType(event.type)) {
    return null;
  }
  if (!matchesHonestAirportMembership(event.data, env)) {
    return null;
  }
  const eventId = subscribeEventIdForWebhook(event);
  if (!eventId) {
    return null;
  }
  const eventTime = eventTimeFromWebhook(event, nowSec);
  const userData = userDataFromRequest({
    email: event.data?.user?.email,
    externalId: event.data?.user?.id,
  });
  return {
    eventId,
    capi: buildActivationCapiEvents({
      eventId,
      eventTime,
      userData,
      env,
    }),
    ga4: buildGa4ActivationEvents({
      eventId,
      userId: event.data?.user?.id,
      eventTimeSec: eventTime,
    }),
  };
}

/** Subscribe half of an activation — kept for callers that only need ads primary. */
export function buildSubscribeEventFromWebhook(
  event: WhopWebhookEnvelope,
  env: WhopEnv = process.env,
  nowSec?: number,
): MetaCapiEvent | null {
  return buildActivationEventsFromWebhook(event, env, nowSec)?.capi[0] ?? null;
}

export type HandleWhopWebhookResult = {
  status: number;
  body: { ok: true; skipped?: string } | { error: string };
  subscribe: MetaCapiEvent | null;
  purchase: MetaCapiEvent | null;
  capiEvents: MetaCapiEvent[];
  ga4: Ga4CollectPayload | null;
};

const EMPTY_EVENTS = {
  subscribe: null,
  purchase: null,
  capiEvents: [] as MetaCapiEvent[],
  ga4: null,
};

/**
 * Verify + map a Whop webhook. CAPI / GA4 send is left to the route so
 * the HTTP 200 can return before Graph or Measurement Protocol is called.
 */
export function handleWhopWebhook(options: {
  rawBody: string;
  headers: Headers | Record<string, string>;
  env?: WhopEnv;
  nowSec?: number;
}): HandleWhopWebhookResult {
  const env = options.env ?? process.env;
  const secret = getWhopWebhookSecret(env);
  if (!secret) {
    return { status: 404, body: { error: "webhook_off" }, ...EMPTY_EVENTS };
  }

  const verified = verifyWhopWebhookSignature({
    rawBody: options.rawBody,
    headers: options.headers,
    secret,
    nowSec: options.nowSec,
  });
  if (!verified.ok) {
    return { status: 401, body: { error: verified.error }, ...EMPTY_EVENTS };
  }

  if (!isWhopSubscribeEventType(verified.event.type)) {
    return {
      status: 200,
      body: { ok: true, skipped: "ignored_type" },
      ...EMPTY_EVENTS,
    };
  }

  const activation = buildActivationEventsFromWebhook(
    verified.event,
    env,
    options.nowSec,
  );
  if (!activation) {
    return {
      status: 200,
      body: { ok: true, skipped: "not_members" },
      ...EMPTY_EVENTS,
    };
  }

  return {
    status: 200,
    body: { ok: true },
    subscribe: activation.capi[0],
    purchase: activation.capi[1],
    capiEvents: [...activation.capi],
    ga4: activation.ga4,
  };
}
