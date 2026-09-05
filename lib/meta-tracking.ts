/**
 * HonestAirport Members paid-tracking constants.
 *
 * Meta Pixel + CAPI only. No GA4/gtag. Tracking is inert until the
 * matching env vars are set — never invent pixel IDs or tokens.
 */

import { readTrimmed, type WhopEnv } from "@/lib/whop-gate";
import { SITE_URL } from "@/lib/site";

export const META_PUBLIC_PIXEL_ID_ENV = "NEXT_PUBLIC_META_PIXEL_ID";
export const META_PIXEL_ID_ENV = "META_PIXEL_ID";
export const META_CAPI_ACCESS_TOKEN_ENV = "META_CAPI_ACCESS_TOKEN";
export const META_CAPI_TEST_EVENT_CODE_ENV = "META_CAPI_TEST_EVENT_CODE";
export const WHOP_WEBHOOK_SECRET_ENV = "WHOP_WEBHOOK_SECRET";

/** Recurring $8/month membership — Meta event is Subscribe, not Purchase. */
export const MEMBER_SUBSCRIBE_VALUE = 8;
export const MEMBER_SUBSCRIBE_CURRENCY = "USD";
export const MEMBER_CONTENT_NAME = "HonestAirport Members";
export const MEMBER_SUBSCRIBE_EVENT = "Subscribe";
export const MEMBER_PLAN_ID = "plan_ee0kSfuyD6v9a";

export const META_GRAPH_VERSION = "v21.0";

export const MEMBERS_EVENT_SOURCE_PATH = "/members";

const PIXEL_ID = /^\d{5,20}$/;

export function getPublicMetaPixelId(env: WhopEnv = process.env): string | null {
  const value = readTrimmed(env, META_PUBLIC_PIXEL_ID_ENV);
  return value && PIXEL_ID.test(value) ? value : null;
}

/** CAPI pixel id. Prefer the server var, then the public Pixel id. */
export function getMetaPixelId(env: WhopEnv = process.env): string | null {
  const server = readTrimmed(env, META_PIXEL_ID_ENV);
  if (server && PIXEL_ID.test(server)) {
    return server;
  }
  return getPublicMetaPixelId(env);
}

export function getMetaCapiAccessToken(env: WhopEnv = process.env): string | null {
  return readTrimmed(env, META_CAPI_ACCESS_TOKEN_ENV);
}

export function getMetaCapiTestEventCode(env: WhopEnv = process.env): string | null {
  return readTrimmed(env, META_CAPI_TEST_EVENT_CODE_ENV);
}

export function getWhopWebhookSecret(env: WhopEnv = process.env): string | null {
  return readTrimmed(env, WHOP_WEBHOOK_SECRET_ENV);
}

export function isMetaPixelEnabled(env: WhopEnv = process.env): boolean {
  return getPublicMetaPixelId(env) !== null;
}

export function isMetaCapiEnabled(env: WhopEnv = process.env): boolean {
  return getMetaPixelId(env) !== null && getMetaCapiAccessToken(env) !== null;
}

export function membersEventSourceUrl(env: WhopEnv = process.env): string {
  const origin = readTrimmed(env, "NEXT_PUBLIC_SITE_URL") || SITE_URL;
  try {
    return new URL(MEMBERS_EVENT_SOURCE_PATH, origin).toString();
  } catch {
    return `https://www.honestairport.com${MEMBERS_EVENT_SOURCE_PATH}`;
  }
}

export type MetaStandardEventName =
  | "PageView"
  | "ViewContent"
  | "InitiateCheckout"
  | "Subscribe";

export type MemberCustomData = {
  value: number;
  currency: string;
  content_name: string;
};

export function memberCustomData(): MemberCustomData {
  return {
    value: MEMBER_SUBSCRIBE_VALUE,
    currency: MEMBER_SUBSCRIBE_CURRENCY,
    content_name: MEMBER_CONTENT_NAME,
  };
}

export function createMetaEventId(prefix = "ha"): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${uuid}`;
}

/** Stable CAPI event_id so Whop webhook retries dedupe in Events Manager. */
export function subscribeEventIdFromWhopId(whopId: string): string {
  return `whop_${whopId.trim()}`;
}
