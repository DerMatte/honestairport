import { appendAttributionToCheckoutUrl, type CheckoutAttribution } from "@/lib/attribution";

/**
 * Whop $8/month membership gate for HonestAirport HTML intel.
 *
 * Entitlements live on Whop (`users.checkAccess`) and are checked live.
 * There is no `isPro` flag in Postgres. The gate is off unless
 * `WHOP_API_KEY` and `WHOP_PRODUCT_ID` are set — same safety as x402.
 *
 * Machine markdown (`.md`) is not gated here; x402 owns paid lounge and
 * extra-tab `.md`. A Whop member can skip x402 via `hasLiveWhopMembership`.
 *
 * Cookie `whopUserId` and the Better Auth `user.whop_user_id` column are
 * identifiers only — access is always a live `users.checkAccess` call.
 */

export const WHOP_API_KEY_ENV = "WHOP_API_KEY";
export const WHOP_COMPANY_ID_ENV = "WHOP_COMPANY_ID";
export const WHOP_PRODUCT_ID_ENV = "WHOP_PRODUCT_ID";
export const WHOP_CHECKOUT_URL_ENV = "NEXT_PUBLIC_WHOP_CHECKOUT_URL";
export const WHOP_SESSION_SECRET_ENV = "WHOP_SESSION_SECRET";

/** Already-created HonestAirport company — do not recreate. */
export const DEFAULT_WHOP_COMPANY_ID = "biz_7f2K9NIDw78ErX";
/** Already-created "HonestAirport Members" product. */
export const DEFAULT_WHOP_PRODUCT_ID = "prod_F5F5XD1OGhQoK";
/** Hosted checkout for plan_ee0kSfuyD6v9a ($8/month USD). */
export const DEFAULT_WHOP_CHECKOUT_URL =
  "https://whop.com/checkout/plan_ee0kSfuyD6v9a";

export const WHOP_SESSION_COOKIE = "whop_session";
export const MIN_SESSION_PASSWORD_LENGTH = 32;

export type WhopEnv = NodeJS.Dict<string>;

export type HtmlAccess = "open" | "allowed" | "denied";

export type WhopSessionData = {
  whopUserId?: string;
  username?: string;
  unlockedAt?: number;
};

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export function readTrimmed(env: WhopEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

/** Live paywall is on only when we can both identify the product and call Whop. */
export function isWhopGateEnabled(env: WhopEnv = process.env): boolean {
  return (
    readTrimmed(env, WHOP_API_KEY_ENV) !== null &&
    readTrimmed(env, WHOP_PRODUCT_ID_ENV) !== null
  );
}

export function getWhopProductId(env: WhopEnv = process.env): string | null {
  return readTrimmed(env, WHOP_PRODUCT_ID_ENV);
}

export function getWhopCompanyId(env: WhopEnv = process.env): string {
  return readTrimmed(env, WHOP_COMPANY_ID_ENV) ?? DEFAULT_WHOP_COMPANY_ID;
}

export function getWhopCheckoutUrl(env: WhopEnv = process.env): string {
  return readTrimmed(env, WHOP_CHECKOUT_URL_ENV) ?? DEFAULT_WHOP_CHECKOUT_URL;
}

/** Header Join link: public checkout URL is set (gate may still be off locally). */
export function isWhopNavEnabled(env: WhopEnv = process.env): boolean {
  return readTrimmed(env, WHOP_CHECKOUT_URL_ENV) !== null;
}

/**
 * iron-session password. Prefer a dedicated Whop secret, then the generic
 * session secret, then Better Auth's existing secret so we do not require
 * another env var in typical local/prod setups.
 */
export function readWhopSessionPassword(env: WhopEnv = process.env): string | null {
  const password =
    readTrimmed(env, WHOP_SESSION_SECRET_ENV) ??
    readTrimmed(env, "SESSION_SECRET") ??
    readTrimmed(env, "BETTER_AUTH_SECRET");
  if (!password || password.length < MIN_SESSION_PASSWORD_LENGTH) {
    return null;
  }
  return password;
}

const AIRPORT_HTML = /^\/airports\/([^/]+)$/;
const LOUNGE_HTML = /^\/airports\/([^/]+)\/lounge\/([^/]+)$/;

/**
 * HTML routes that require an active membership when the gate is on.
 * Only individual lounge pages are fully gated. The airport page itself
 * stays reachable (overview + lounge directory are free; other tabs
 * gate in `AirportDetailTabs`). `.md` stays with x402.
 */
export function isGatedHtmlPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path.endsWith(".md")) {
    return false;
  }
  return LOUNGE_HTML.test(path);
}

/**
 * Airport HTML page (`/airports/lax`) — free shell. Paid tabs are gated
 * inside the page, not by this path helper.
 */
export function isAirportHtmlPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path.endsWith(".md")) {
    return false;
  }
  return AIRPORT_HTML.test(path);
}

/**
 * Everything that is not a fully gated HTML lounge page stays free of the
 * whole-page Whop paywall (homepage, airport overview, search, auth,
 * discovery markdown, robots/sitemap). Extra airport tabs and lounge
 * `.md` still charge via in-page teaser / x402.
 */
export function isFreePublicPath(pathname: string): boolean {
  return !isGatedHtmlPath(pathname);
}

export function shouldShowMembershipTeaser(
  pathname: string,
  access: HtmlAccess,
): boolean {
  return access === "denied" && isGatedHtmlPath(pathname);
}

/**
 * Prefer the Whop session cookie, then the signed-in account's stored
 * `whopUserId`. Neither value is an entitlement — `checkAccess` still runs.
 */
export function resolveWhopUserId(
  cookieWhopUserId?: string | null,
  accountWhopUserId?: string | null,
): string | null {
  const fromCookie = cookieWhopUserId?.trim() || "";
  if (fromCookie) {
    return fromCookie;
  }
  const fromAccount = accountWhopUserId?.trim() || "";
  return fromAccount || null;
}

export type ResolveHtmlAccessOptions = {
  env?: WhopEnv;
  whopUserId?: string | null;
  checkAccess?: (productId: string, userId: string) => Promise<boolean>;
};

/**
 * Decide whether a gated HTML render may show intel.
 * `open` = paywall env missing (current ungated behavior).
 * `denied` = gate on and no live membership.
 * `allowed` = live `users.checkAccess` returned has_access.
 */
export async function resolveHtmlAccess(
  options: ResolveHtmlAccessOptions = {},
): Promise<HtmlAccess> {
  const env = options.env ?? process.env;
  if (!isWhopGateEnabled(env)) {
    return "open";
  }

  const userId = options.whopUserId?.trim() || null;
  if (!userId) {
    return "denied";
  }

  const productId = getWhopProductId(env);
  if (!productId) {
    return "denied";
  }

  if (!options.checkAccess) {
    return "denied";
  }

  try {
    const ok = await options.checkAccess(productId, userId);
    return ok ? "allowed" : "denied";
  } catch {
    return "denied";
  }
}

export function membershipCheckoutHref(
  returnPath = "/members",
  env: WhopEnv = process.env,
  siteUrl?: string,
  attribution?: CheckoutAttribution | null,
): string {
  const checkout = getWhopCheckoutUrl(env);
  try {
    const url = new URL(checkout);
    if (siteUrl) {
      const complete = new URL("/members", siteUrl);
      complete.searchParams.set("next", returnPath);
      url.searchParams.set("redirect", complete.toString());
    }
    return appendAttributionToCheckoutUrl(url.toString(), attribution);
  } catch {
    return checkout;
  }
}
