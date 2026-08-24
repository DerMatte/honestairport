/**
 * Account-based Whop membership check for paid lounge / airport-tab markdown.
 *
 * MCP sends `Authorization: Bearer ha_mcp_...` and has no Whop cookie, so
 * access is resolved from the Better Auth user's stored `whopUserId` plus
 * the official Users API (`users.checkAccess` / GET
 * `/users/{id}/access/{resource_id}`).
 *
 * If Whop env is unset, this never grants a skip — x402 still applies when
 * `X402_PAY_TO` is set. Missing or failed checks fail closed (no skip).
 */
export const WHOP_API_KEY_ENV = "WHOP_API_KEY";
export const WHOP_PRODUCT_ID_ENV = "WHOP_PRODUCT_ID";
export const WHOP_API_BASE_URL_ENV = "WHOP_API_BASE_URL";

export const DEFAULT_WHOP_API_BASE_URL = "https://api.whop.com/api/v1";

export type WhopEnv = NodeJS.Dict<string>;

export type CheckWhopProductAccess = (
  whopUserId: string,
  env?: WhopEnv,
) => Promise<boolean>;

function readTrimmed(env: WhopEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

/** Both key and product id are required before we ask Whop. */
export function isWhopAccessConfigured(env: WhopEnv = process.env): boolean {
  return (
    readTrimmed(env, WHOP_API_KEY_ENV) !== null &&
    readTrimmed(env, WHOP_PRODUCT_ID_ENV) !== null
  );
}

function accessUrl(whopUserId: string, productId: string, env: WhopEnv): string {
  const base =
    readTrimmed(env, WHOP_API_BASE_URL_ENV) ?? DEFAULT_WHOP_API_BASE_URL;
  return `${base.replace(/\/$/, "")}/users/${encodeURIComponent(whopUserId)}/access/${encodeURIComponent(productId)}`;
}

/**
 * Official `users.checkAccess` equivalent: does this Whop user have the
 * configured product? Fail closed on non-OK responses or missing `has_access`.
 */
export async function checkWhopProductAccess(
  whopUserId: string,
  env: WhopEnv = process.env,
): Promise<boolean> {
  const apiKey = readTrimmed(env, WHOP_API_KEY_ENV);
  const productId = readTrimmed(env, WHOP_PRODUCT_ID_ENV);
  if (!apiKey || !productId) {
    return false;
  }

  const response = await fetch(accessUrl(whopUserId, productId, env), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return false;
  }

  const body: unknown = await response.json();
  return (
    typeof body === "object" &&
    body !== null &&
    "has_access" in body &&
    (body as { has_access: unknown }).has_access === true
  );
}

/**
 * True only when the account has a stored Whop user id *and* Whop reports
 * live product access. Unset Whop env or a missing id never skip x402.
 */
export async function userHasLiveWhopMembership(
  user: { whopUserId?: string | null },
  env: WhopEnv = process.env,
  checkAccess?: CheckWhopProductAccess,
): Promise<boolean> {
  const whopUserId = user.whopUserId?.trim();
  if (!whopUserId || !isWhopAccessConfigured(env)) {
    return false;
  }

  const check = checkAccess ?? checkWhopProductAccess;
  try {
    return await check(whopUserId, env);
  } catch {
    return false;
  }
}
