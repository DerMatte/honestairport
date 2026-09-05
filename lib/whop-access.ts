import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { NotFoundError } from "@whop/sdk";
import { auth } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { SITE_URL } from "@/lib/site";
import { getWhop } from "@/lib/whop";
import type { CheckoutAttribution } from "@/lib/attribution";
import {
  getWhopProductId,
  isWhopGateEnabled,
  membershipCheckoutHref,
  resolveHtmlAccess,
  resolveWhopUserId,
  type HtmlAccess,
  type WhopEnv,
} from "@/lib/whop-gate";
import { getWhopSession } from "@/lib/whop-session";

export {
  isWhopGateEnabled as isWhopAccessConfigured,
  WHOP_API_KEY_ENV,
  WHOP_PRODUCT_ID_ENV,
  type WhopEnv,
} from "@/lib/whop-gate";

export const checkProductAccess = cache(
  async (productId: string, whopUserId: string): Promise<boolean> => {
    try {
      const result = await getWhop().users.checkAccess(productId, {
        id: whopUserId,
      });
      return result.has_access;
    } catch {
      return false;
    }
  },
);

async function readAccountWhopUserId(): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const stored = session?.user?.whopUserId;
    return typeof stored === "string" && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

/** Live membership check. Off / missing session never calls Whop. */
export const getHtmlAccess = cache(async function getHtmlAccess(
  env: WhopEnv = process.env,
): Promise<HtmlAccess> {
  if (!isWhopGateEnabled(env)) {
    return "open";
  }
  const [session, accountWhopUserId] = await Promise.all([
    getWhopSession(env),
    readAccountWhopUserId(),
  ]);
  return resolveHtmlAccess({
    env,
    whopUserId: resolveWhopUserId(session?.whopUserId, accountWhopUserId),
    checkAccess: checkProductAccess,
  });
});

/** True only when the gate is on and Whop currently grants the product. */
export async function hasLiveWhopMembership(
  env: WhopEnv = process.env,
): Promise<boolean> {
  return (await getHtmlAccess(env)) === "allowed";
}

export function checkoutUrlForPath(
  returnPath = "/members",
  env: WhopEnv = process.env,
  attribution?: CheckoutAttribution | null,
): string {
  return membershipCheckoutHref(
    returnPath,
    env,
    env.NEXT_PUBLIC_SITE_URL?.trim() || SITE_URL,
    attribution,
  );
}

export type UnlockResult =
  | { ok: true; username: string | null }
  | { ok: false; status: number; error: string };

const RECEIPT_ID = /^pay_[A-Za-z0-9]{4,60}$/;

export function isWhopReceiptId(value: string): boolean {
  return RECEIPT_ID.test(value);
}

export type UnlockFromReceiptOptions = {
  /** Better Auth user id to persist `whopUserId` on. Cookie still always saved. */
  accountUserId?: string | null;
};

/**
 * Write the verified Whop member id onto the signed-in Better Auth user.
 * Identifier only — not an `isPro` flag. No-ops when the DB is unset.
 */
export async function persistWhopUserIdOnAccount(
  accountUserId: string,
  whopUserId: string,
): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return false;
  }
  const userId = accountUserId.trim();
  const stored = whopUserId.trim();
  if (!userId || !stored) {
    return false;
  }
  try {
    await getDb()
      .update(user)
      .set({ whopUserId: stored, updatedAt: new Date() })
      .where(eq(user.id, userId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Exchange a verified Whop receipt for a session cookie.
 * Authorization still re-checks `users.checkAccess` on the next render.
 * When the visitor is signed in, also persist `whopUserId` on their account.
 */
export async function unlockFromReceipt(
  receiptId: string,
  env: WhopEnv = process.env,
  options: UnlockFromReceiptOptions = {},
): Promise<UnlockResult> {
  if (!isWhopGateEnabled(env)) {
    return { ok: false, status: 404, error: "gate_off" };
  }
  if (!isWhopReceiptId(receiptId)) {
    return { ok: false, status: 400, error: "invalid_receipt" };
  }

  const productId = getWhopProductId(env);
  if (!productId) {
    return { ok: false, status: 404, error: "gate_off" };
  }

  let payment;
  try {
    payment = await getWhop(env).payments.retrieve(receiptId);
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return { ok: false, status: 404, error: "not_found" };
    }
    throw error;
  }

  if (!payment.product?.id || payment.product.id !== productId) {
    return { ok: false, status: 403, error: "wrong_product" };
  }

  if (payment.status === "pending" || payment.status === "open") {
    return { ok: false, status: 202, error: "pending" };
  }

  const refunded =
    payment.substatus === "refunded" ||
    payment.substatus === "auto_refunded" ||
    payment.refunded_at !== null;

  if (payment.status !== "paid" || refunded) {
    return { ok: false, status: 403, error: "not_paid" };
  }

  if (!payment.user?.id) {
    return { ok: false, status: 502, error: "no_user" };
  }

  const session = await getWhopSession(env);
  if (!session) {
    return { ok: false, status: 503, error: "session_unconfigured" };
  }

  session.whopUserId = payment.user.id;
  session.username = payment.user.username;
  session.unlockedAt = Date.now();
  await session.save();

  if (options.accountUserId) {
    await persistWhopUserIdOnAccount(options.accountUserId, payment.user.id);
  }

  return { ok: true, username: payment.user.username };
}

/**
 * Account-based Whop membership check for paid lounge / airport-tab markdown
 * and MCP `get_lounge`. MCP sends `Authorization: Bearer ha_mcp_...` and has
 * no Whop cookie, so access is resolved from the Better Auth user's stored
 * `whopUserId` plus a live `users.checkAccess`.
 *
 * If Whop env is unset, this never grants a skip — x402 still applies when
 * `X402_PAY_TO` is set. Missing or failed checks fail closed (no skip).
 */
export type CheckWhopProductAccess = (
  whopUserId: string,
  env?: WhopEnv,
) => Promise<boolean>;

export async function checkWhopProductAccess(
  whopUserId: string,
  env: WhopEnv = process.env,
): Promise<boolean> {
  const productId = getWhopProductId(env);
  if (!productId || !whopUserId.trim()) {
    return false;
  }
  try {
    const result = await getWhop(env).users.checkAccess(productId, {
      id: whopUserId,
    });
    return result.has_access;
  } catch {
    return false;
  }
}

/**
 * True only when the account has a stored Whop user id *and* Whop reports
 * live product access. Unset Whop env or a missing id never skip x402.
 */
export async function userHasLiveWhopMembership(
  userRecord: { whopUserId?: string | null },
  env: WhopEnv = process.env,
  checkAccess?: CheckWhopProductAccess,
): Promise<boolean> {
  const whopUserId = userRecord.whopUserId?.trim();
  if (!whopUserId || !isWhopGateEnabled(env)) {
    return false;
  }

  const check = checkAccess ?? checkWhopProductAccess;
  try {
    return await check(whopUserId, env);
  } catch {
    return false;
  }
}
