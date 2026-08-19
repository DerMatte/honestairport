import Whop from "@whop/sdk";
import { readTrimmed, WHOP_API_KEY_ENV, type WhopEnv } from "@/lib/whop-gate";

let cached: Whop | null = null;
let cachedKey: string | null = null;

export function getWhop(env: WhopEnv = process.env): Whop {
  const apiKey = readTrimmed(env, WHOP_API_KEY_ENV);
  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not set");
  }
  if (cached && cachedKey === apiKey) {
    return cached;
  }
  cached = new Whop({ apiKey });
  cachedKey = apiKey;
  return cached;
}

/** Test helper — drop the cached SDK client. */
export function resetWhopClient(): void {
  cached = null;
  cachedKey = null;
}
