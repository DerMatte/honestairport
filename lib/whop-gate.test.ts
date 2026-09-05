import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WHOP_CHECKOUT_URL,
  DEFAULT_WHOP_COMPANY_ID,
  DEFAULT_WHOP_PRODUCT_ID,
  getWhopCheckoutUrl,
  getWhopCompanyId,
  getWhopProductId,
  isAirportHtmlPath,
  isFreePublicPath,
  isGatedHtmlPath,
  isWhopGateEnabled,
  isWhopNavEnabled,
  membershipCheckoutHref,
  readWhopSessionPassword,
  resolveHtmlAccess,
  resolveWhopUserId,
  shouldShowMembershipTeaser,
} from "./whop-gate";

const enabledEnv = {
  WHOP_API_KEY: " apik_test_key ",
  WHOP_PRODUCT_ID: ` ${DEFAULT_WHOP_PRODUCT_ID} `,
  WHOP_COMPANY_ID: DEFAULT_WHOP_COMPANY_ID,
  NEXT_PUBLIC_WHOP_CHECKOUT_URL: DEFAULT_WHOP_CHECKOUT_URL,
};

const FREE_ROUTES = [
  "/",
  "/login",
  "/settings",
  "/reset-password",
  "/members",
  "/index.md",
  "/sitemap.md",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/api/auth/sign-in/email",
  "/api/revalidate",
  "/api/airports/search",
  "/api/airports/LAX/generate",
  "/airports/lax.md",
  "/airports/lax/lounges.md",
  "/airports/lax/getting-there.md",
  "/airports/lax/lounge/star-alliance.md",
  "/airports/lax",
  "/airports/LAX",
  "/airports/lax/",
  "/airports/muc",
];

const GATED_ROUTES = [
  "/airports/lax/lounge/star-alliance",
  "/airports/lax/lounge/centurion/",
];

describe("isWhopGateEnabled", () => {
  it("is off when API key or product id is missing or blank", () => {
    assert.equal(isWhopGateEnabled({}), false);
    assert.equal(isWhopGateEnabled({ WHOP_API_KEY: "apik_x" }), false);
    assert.equal(isWhopGateEnabled({ WHOP_PRODUCT_ID: DEFAULT_WHOP_PRODUCT_ID }), false);
    assert.equal(isWhopGateEnabled({ WHOP_API_KEY: "  ", WHOP_PRODUCT_ID: DEFAULT_WHOP_PRODUCT_ID }), false);
    assert.equal(isWhopGateEnabled({ WHOP_API_KEY: "apik_x", WHOP_PRODUCT_ID: "" }), false);
  });

  it("is on when both WHOP_API_KEY and WHOP_PRODUCT_ID are set", () => {
    assert.equal(isWhopGateEnabled(enabledEnv), true);
    assert.equal(getWhopProductId(enabledEnv), DEFAULT_WHOP_PRODUCT_ID);
    assert.equal(getWhopCompanyId(enabledEnv), DEFAULT_WHOP_COMPANY_ID);
    assert.equal(getWhopCheckoutUrl(enabledEnv), DEFAULT_WHOP_CHECKOUT_URL);
  });
});

describe("isGatedHtmlPath / isFreePublicPath", () => {
  it("gates individual lounge HTML only", () => {
    for (const path of GATED_ROUTES) {
      assert.equal(isGatedHtmlPath(path), true, path);
      assert.equal(isFreePublicPath(path), false, path);
    }
  });

  it("keeps homepage, airport overview, auth, discovery, search, generate, and markdown free", () => {
    for (const path of FREE_ROUTES) {
      assert.equal(isGatedHtmlPath(path), false, path);
      assert.equal(isFreePublicPath(path), true, path);
    }
  });

  it("does not treat opengraph or unknown airport extras as gated HTML intel", () => {
    assert.equal(isGatedHtmlPath("/airports/lax/opengraph-image"), false);
    assert.equal(isFreePublicPath("/airports/lax/opengraph-image"), true);
    assert.equal(isAirportHtmlPath("/airports/lax"), true);
    assert.equal(isAirportHtmlPath("/airports/lax/lounge/star"), false);
  });
});

describe("resolveHtmlAccess / shouldShowMembershipTeaser", () => {
  it("stays open when Whop env is missing — no surprise lock", async () => {
    assert.equal(await resolveHtmlAccess({ env: {} }), "open");
    assert.equal(await resolveHtmlAccess({ env: { WHOP_API_KEY: "apik_x" } }), "open");
    assert.equal(shouldShowMembershipTeaser("/airports/lax", "open"), false);
  });

  it("denies a gated lounge path without a membership session", async () => {
    const access = await resolveHtmlAccess({
      env: enabledEnv,
      whopUserId: null,
    });
    assert.equal(access, "denied");
    assert.equal(shouldShowMembershipTeaser("/airports/lax", access), false);
    assert.equal(
      shouldShowMembershipTeaser("/airports/lax/lounge/star-alliance", access),
      true,
    );
  });

  it("does not show a teaser on free routes even if access is denied", async () => {
    const access = await resolveHtmlAccess({
      env: enabledEnv,
      whopUserId: "",
    });
    assert.equal(access, "denied");
    for (const path of FREE_ROUTES) {
      assert.equal(shouldShowMembershipTeaser(path, access), false, path);
    }
  });

  it("allows only when live checkAccess returns has_access", async () => {
    const allowed = await resolveHtmlAccess({
      env: enabledEnv,
      whopUserId: "user_member",
      checkAccess: async (productId, userId) => {
        assert.equal(productId, DEFAULT_WHOP_PRODUCT_ID);
        assert.equal(userId, "user_member");
        return true;
      },
    });
    assert.equal(allowed, "allowed");
    assert.equal(
      shouldShowMembershipTeaser("/airports/lax/lounge/star-alliance", allowed),
      false,
    );

    const canceled = await resolveHtmlAccess({
      env: enabledEnv,
      whopUserId: "user_canceled",
      checkAccess: async () => false,
    });
    assert.equal(canceled, "denied");
    assert.equal(
      shouldShowMembershipTeaser("/airports/lax/lounge/star-alliance", canceled),
      true,
    );
  });

  it("denies when checkAccess throws (Whop outage)", async () => {
    const access = await resolveHtmlAccess({
      env: enabledEnv,
      whopUserId: "user_member",
      checkAccess: async () => {
        throw new Error("whop down");
      },
    });
    assert.equal(access, "denied");
  });
});

describe("session password / nav / checkout href", () => {
  it("requires a 32+ character secret and prefers WHOP_SESSION_SECRET", () => {
    assert.equal(readWhopSessionPassword({}), null);
    assert.equal(readWhopSessionPassword({ BETTER_AUTH_SECRET: "too-short" }), null);
    const better = "b".repeat(32);
    const dedicated = "w".repeat(32);
    assert.equal(readWhopSessionPassword({ BETTER_AUTH_SECRET: better }), better);
    assert.equal(
      readWhopSessionPassword({
        BETTER_AUTH_SECRET: better,
        WHOP_SESSION_SECRET: dedicated,
      }),
      dedicated,
    );
  });

  it("shows the header Join link only when the public checkout URL is set", () => {
    assert.equal(isWhopNavEnabled({}), false);
    assert.equal(isWhopNavEnabled(enabledEnv), true);
  });

  it("appends a members return URL onto the hosted checkout link", () => {
    const href = membershipCheckoutHref(
      "/airports/lax",
      enabledEnv,
      "https://www.honestairport.com",
    );
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, DEFAULT_WHOP_CHECKOUT_URL);
    assert.equal(
      url.searchParams.get("redirect"),
      "https://www.honestairport.com/members?next=%2Fairports%2Flax",
    );
  });

  it("merges attribution onto checkout without replacing redirect", () => {
    const href = membershipCheckoutHref(
      "/airports/lax",
      enabledEnv,
      "https://www.honestairport.com",
      { utm_source: "meta", utm_campaign: "members", event_id: "ic_1" },
    );
    const url = new URL(href);
    assert.equal(
      url.searchParams.get("redirect"),
      "https://www.honestairport.com/members?next=%2Fairports%2Flax",
    );
    assert.equal(url.searchParams.get("utm_source"), "meta");
    assert.equal(url.searchParams.get("event_id"), "ic_1");
  });
});

describe("resolveWhopUserId", () => {
  it("prefers the cookie id, then the signed-in account id", () => {
    assert.equal(resolveWhopUserId("user_cookie", "user_account"), "user_cookie");
    assert.equal(resolveWhopUserId(null, "user_account"), "user_account");
    assert.equal(resolveWhopUserId("  ", "user_account"), "user_account");
    assert.equal(resolveWhopUserId(null, null), null);
  });
});
