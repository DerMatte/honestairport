/**
 * Meta Conversions API helper. No-ops when pixel id or access token is unset.
 * Never logs tokens. Tests inject `fetchImpl` so CI never hits Graph.
 */

import { createHash } from "node:crypto";
import {
  getMetaCapiAccessToken,
  getMetaCapiTestEventCode,
  getMetaPixelId,
  isMetaCapiEnabled,
  membersEventSourceUrl,
  memberCustomData,
  META_GRAPH_VERSION,
  type MemberCustomData,
  type MetaStandardEventName,
} from "@/lib/meta-tracking";
import type { WhopEnv } from "@/lib/whop-gate";

export type MetaCapiUserData = {
  em?: string[];
  external_id?: string;
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type MetaCapiEvent = {
  event_name: MetaStandardEventName;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: MetaCapiUserData;
  custom_data?: MemberCustomData;
};

export type MetaCapiUserInput = {
  email?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
};

/** Meta email rule: trim, lowercase, SHA-256 hex. */
export function hashMetaPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

export function userDataFromRequest(
  input: MetaCapiUserInput = {},
  headers?: Headers | null,
): MetaCapiUserData {
  const userData: MetaCapiUserData = {};
  const email = input.email?.trim();
  if (email) {
    userData.em = [hashMetaPii(email)];
  }
  const externalId = input.externalId?.trim();
  if (externalId) {
    userData.external_id = externalId;
  }
  const fbp = input.fbp?.trim() || (headers ? readCookie(headers, "_fbp") : null);
  if (fbp) {
    userData.fbp = fbp;
  }
  const fbc = input.fbc?.trim() || (headers ? readCookie(headers, "_fbc") : null);
  if (fbc) {
    userData.fbc = fbc;
  }
  const ip = input.clientIp?.trim() || (headers ? clientIpFromHeaders(headers) : null);
  if (ip) {
    userData.client_ip_address = ip;
  }
  const ua =
    input.clientUserAgent?.trim() || headers?.get("user-agent")?.trim() || null;
  if (ua) {
    userData.client_user_agent = ua;
  }
  return userData;
}

function readCookie(headers: Headers, name: string): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) {
    return null;
  }
  const parts = cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

export function buildMetaCapiEvent(options: {
  eventName: MetaStandardEventName;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  userData?: MetaCapiUserData;
  customData?: MemberCustomData | false;
  env?: WhopEnv;
}): MetaCapiEvent {
  const event: MetaCapiEvent = {
    event_name: options.eventName,
    event_time: options.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: options.eventId,
    event_source_url: options.eventSourceUrl ?? membersEventSourceUrl(options.env),
    action_source: "website",
    user_data: options.userData ?? {},
  };
  if (options.customData !== false) {
    event.custom_data = options.customData ?? memberCustomData();
  }
  return event;
}

export function buildSubscribeCapiEvent(options: {
  eventId: string;
  eventTime?: number;
  userData?: MetaCapiUserData;
  env?: WhopEnv;
}): MetaCapiEvent {
  return buildMetaCapiEvent({
    eventName: "Subscribe",
    eventId: options.eventId,
    eventTime: options.eventTime,
    userData: options.userData,
    env: options.env,
  });
}

export type SendMetaCapiResult =
  | { ok: true; skipped: "capi_off" | "empty" }
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export async function sendMetaCapiEvents(
  events: MetaCapiEvent[],
  options: {
    env?: WhopEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SendMetaCapiResult> {
  const env = options.env ?? process.env;
  if (!isMetaCapiEnabled(env)) {
    return { ok: true, skipped: "capi_off" };
  }
  if (events.length === 0) {
    return { ok: true, skipped: "empty" };
  }

  const pixelId = getMetaPixelId(env);
  const token = getMetaCapiAccessToken(env);
  if (!pixelId || !token) {
    return { ok: true, skipped: "capi_off" };
  }

  const body: Record<string, unknown> = {
    data: events,
    access_token: token,
  };
  const testCode = getMetaCapiTestEventCode(env);
  if (testCode) {
    body.test_event_code = testCode;
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: "capi_http" };
    }
    return { ok: true, status: response.status };
  } catch {
    return { ok: false, error: "capi_network" };
  }
}
