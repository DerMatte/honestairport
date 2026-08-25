import Whop from "@whop/sdk";
import { readTrimmed, WHOP_API_KEY_ENV, type WhopEnv } from "@/lib/whop-gate";

export const WHOP_SANDBOX_ENV = "WHOP_SANDBOX";
export const WHOP_API_BASE_URL_ENV = "WHOP_API_BASE_URL";

/** Whop sandbox API. Must include `/api/v1` — the SDK appends resource paths. */
export const WHOP_SANDBOX_API_BASE_URL = "https://sandbox-api.whop.com/api/v1";

const TRUTHY_ENV = new Set(["1", "true", "yes"]);

let cached: Whop | null = null;
let cachedKey: string | null = null;

/** Preview/dev flag. Production must leave `WHOP_SANDBOX` unset. */
export function isWhopSandbox(env: WhopEnv = process.env): boolean {
  const value = env[WHOP_SANDBOX_ENV]?.trim().toLowerCase();
  return value != null && TRUTHY_ENV.has(value);
}

/**
 * SDK `baseURL` when sandbox is on. Production returns `undefined` so the
 * client keeps the live default (no `baseURL` option).
 */
export function resolveWhopBaseURL(env: WhopEnv = process.env): string | undefined {
  if (!isWhopSandbox(env)) {
    return undefined;
  }
  return readTrimmed(env, WHOP_API_BASE_URL_ENV) ?? WHOP_SANDBOX_API_BASE_URL;
}

function clientCacheKey(
  apiKey: string,
  sandbox: boolean,
  baseURL: string | undefined,
): string {
  return `${apiKey}|sandbox=${sandbox ? "1" : "0"}|base=${baseURL ?? ""}`;
}

export function getWhop(env: WhopEnv = process.env): Whop {
  const apiKey = readTrimmed(env, WHOP_API_KEY_ENV);
  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not set");
  }
  const sandbox = isWhopSandbox(env);
  const baseURL = resolveWhopBaseURL(env);
  const key = clientCacheKey(apiKey, sandbox, baseURL);
  if (cached && cachedKey === key) {
    return cached;
  }
  cached = baseURL ? new Whop({ apiKey, baseURL }) : new Whop({ apiKey });
  cachedKey = key;
  return cached;
}

/** Test helper — drop the cached SDK client. */
export function resetWhopClient(): void {
  cached = null;
  cachedKey = null;
}
