/**
 * First-touch / last-touch UTM + click-id hygiene for the Whop checkout hop.
 *
 * First-touch is immutable once written. Last-touch updates whenever a
 * landing URL carries attribution params. Checkout URLs get last-touch
 * (falling back to first-touch) without touching the existing `redirect`.
 */

export const FIRST_TOUCH_COOKIE = "ha_attr_first";
export const LAST_TOUCH_COOKIE = "ha_attr_last";
export const FIRST_TOUCH_MAX_AGE_SEC = 60 * 60 * 24 * 180;
export const LAST_TOUCH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export type Attribution = Partial<Record<AttributionKey, string>>;

export type CheckoutAttribution = Attribution & {
  event_id?: string;
};

const CHECKOUT_EXTRA_KEYS = ["event_id"] as const;

function trimParam(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAttributionFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): Attribution {
  const get =
    params instanceof URLSearchParams
      ? (key: string) => params.get(key)
      : (key: string) => {
          const raw = params[key];
          return Array.isArray(raw) ? raw[0] : raw;
        };

  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = trimParam(get(key));
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

export function hasAttribution(value: Attribution | null | undefined): boolean {
  if (!value) return false;
  return ATTRIBUTION_KEYS.some((key) => Boolean(value[key]));
}

/** Last-touch wins; first-touch fills gaps. */
export function attributionForCheckout(
  first: Attribution | null | undefined,
  last: Attribution | null | undefined,
): Attribution {
  return { ...first, ...last };
}

/**
 * Append attribution query params onto a hosted checkout URL.
 * Existing keys (including `redirect`) are left alone.
 */
export function appendAttributionToCheckoutUrl(
  checkoutUrl: string,
  attribution?: CheckoutAttribution | null,
): string {
  if (!attribution || (!hasAttribution(attribution) && !attribution.event_id?.trim())) {
    return checkoutUrl;
  }

  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    return checkoutUrl;
  }

  for (const key of ATTRIBUTION_KEYS) {
    const value = trimParam(attribution[key]);
    if (!value || url.searchParams.has(key)) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  for (const key of CHECKOUT_EXTRA_KEYS) {
    const value = trimParam(attribution[key]);
    if (!value || url.searchParams.has(key)) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function serializeAttribution(value: Attribution): string {
  const compact: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const item = trimParam(value[key]);
    if (item) {
      compact[key] = item;
    }
  }
  return JSON.stringify(compact);
}

export function parseAttributionCookie(raw: string | null | undefined): Attribution | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parseAttributionFromSearchParams(parsed as Record<string, string | undefined>);
  } catch {
    return null;
  }
}

export function readCookieFromHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

export function readStoredAttribution(cookieHeader: string | null | undefined): {
  first: Attribution | null;
  last: Attribution | null;
} {
  return {
    first: parseAttributionCookie(readCookieFromHeader(cookieHeader, FIRST_TOUCH_COOKIE)),
    last: parseAttributionCookie(readCookieFromHeader(cookieHeader, LAST_TOUCH_COOKIE)),
  };
}

export type AttributionTouchUpdate = {
  name: typeof FIRST_TOUCH_COOKIE | typeof LAST_TOUCH_COOKIE;
  value: Attribution;
  maxAgeSec: number;
};

/**
 * Decide cookie writes for a landing. First-touch is written only when
 * missing; last-touch updates whenever the URL carries attribution.
 */
export function nextAttributionTouches(
  incoming: Attribution,
  existingFirst: Attribution | null,
  existingLast: Attribution | null,
): AttributionTouchUpdate[] {
  if (!hasAttribution(incoming)) {
    return [];
  }

  const writes: AttributionTouchUpdate[] = [];
  if (!hasAttribution(existingFirst)) {
    writes.push({
      name: FIRST_TOUCH_COOKIE,
      value: incoming,
      maxAgeSec: FIRST_TOUCH_MAX_AGE_SEC,
    });
  }
  if (
    !existingLast ||
    serializeAttribution(existingLast) !== serializeAttribution(incoming)
  ) {
    writes.push({
      name: LAST_TOUCH_COOKIE,
      value: incoming,
      maxAgeSec: LAST_TOUCH_MAX_AGE_SEC,
    });
  }
  return writes;
}

export function attributionCookieHeader(
  name: string,
  value: Attribution,
  maxAgeSec: number,
): string {
  return `${name}=${encodeURIComponent(serializeAttribution(value))}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}
