import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendAttributionToCheckoutUrl,
  attributionForCheckout,
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  nextAttributionTouches,
  parseAttributionCookie,
  parseAttributionFromSearchParams,
  readStoredAttribution,
  serializeAttribution,
} from "./attribution";
import { DEFAULT_WHOP_CHECKOUT_URL, membershipCheckoutHref } from "./whop-gate";

const checkout = DEFAULT_WHOP_CHECKOUT_URL;
const enabledEnv = {
  NEXT_PUBLIC_WHOP_CHECKOUT_URL: checkout,
};

describe("parseAttributionFromSearchParams", () => {
  it("keeps utm_* plus click ids and drops empties / unknown keys", () => {
    const params = new URLSearchParams(
      "utm_source=meta&utm_medium=paid&utm_campaign=members&utm_content=hero&utm_term=airport&fbclid=abc.1&gclid=g1&redirect=/nope&foo=bar&utm_source=",
    );
    assert.deepEqual(parseAttributionFromSearchParams(params), {
      utm_source: "meta",
      utm_medium: "paid",
      utm_campaign: "members",
      utm_content: "hero",
      utm_term: "airport",
      fbclid: "abc.1",
      gclid: "g1",
    });
  });
});

describe("appendAttributionToCheckoutUrl / membershipCheckoutHref", () => {
  it("appends last-touch UTMs and click ids without touching redirect", () => {
    const href = membershipCheckoutHref(
      "/airports/lax",
      enabledEnv,
      "https://www.honestairport.com",
      {
        utm_source: "meta",
        utm_medium: "paid",
        utm_campaign: "members",
        fbclid: "fb.1.click",
        event_id: "ic_test-event",
      },
    );
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, checkout);
    assert.equal(
      url.searchParams.get("redirect"),
      "https://www.honestairport.com/members?next=%2Fairports%2Flax",
    );
    assert.equal(url.searchParams.get("utm_source"), "meta");
    assert.equal(url.searchParams.get("utm_medium"), "paid");
    assert.equal(url.searchParams.get("utm_campaign"), "members");
    assert.equal(url.searchParams.get("fbclid"), "fb.1.click");
    assert.equal(url.searchParams.get("event_id"), "ic_test-event");
  });

  it("does not overwrite query keys already on the checkout URL", () => {
    const existing = `${checkout}?utm_source=whop-default&redirect=https://example.com/keep`;
    const merged = appendAttributionToCheckoutUrl(existing, {
      utm_source: "meta",
      utm_medium: "paid",
      event_id: "ic_1",
    });
    const url = new URL(merged);
    assert.equal(url.searchParams.get("utm_source"), "whop-default");
    assert.equal(url.searchParams.get("redirect"), "https://example.com/keep");
    assert.equal(url.searchParams.get("utm_medium"), "paid");
    assert.equal(url.searchParams.get("event_id"), "ic_1");
  });

  it("returns the original string when the checkout URL is not absolute", () => {
    assert.equal(
      appendAttributionToCheckoutUrl("/relative", { utm_source: "meta" }),
      "/relative",
    );
  });

  it("prefers last-touch values when building checkout attribution", () => {
    assert.deepEqual(
      attributionForCheckout(
        { utm_source: "first", utm_campaign: "launch", fbclid: "old" },
        { utm_source: "meta", utm_medium: "paid" },
      ),
      {
        utm_source: "meta",
        utm_campaign: "launch",
        fbclid: "old",
        utm_medium: "paid",
      },
    );
  });
});

describe("first-touch / last-touch cookies", () => {
  it("writes first-touch once and refreshes last-touch on a new landing", () => {
    const firstLanding = { utm_source: "meta", utm_campaign: "a" };
    const firstWrites = nextAttributionTouches(firstLanding, null, null);
    assert.equal(firstWrites.length, 2);
    assert.equal(firstWrites[0]?.name, FIRST_TOUCH_COOKIE);
    assert.deepEqual(firstWrites[0]?.value, firstLanding);
    assert.equal(firstWrites[1]?.name, LAST_TOUCH_COOKIE);

    const secondLanding = { utm_source: "ig", utm_campaign: "b" };
    const secondWrites = nextAttributionTouches(
      secondLanding,
      firstLanding,
      firstLanding,
    );
    assert.equal(secondWrites.length, 1);
    assert.equal(secondWrites[0]?.name, LAST_TOUCH_COOKIE);
    assert.deepEqual(secondWrites[0]?.value, secondLanding);
  });

  it("does not write when the URL has no attribution params", () => {
    assert.deepEqual(nextAttributionTouches({}, { utm_source: "meta" }, null), []);
  });

  it("round-trips cookie JSON through a Cookie header", () => {
    const value = { utm_source: "meta", fbclid: "x y" };
    const header = `${FIRST_TOUCH_COOKIE}=${encodeURIComponent(serializeAttribution(value))}; ${LAST_TOUCH_COOKIE}=${encodeURIComponent(serializeAttribution({ utm_medium: "paid" }))}`;
    const stored = readStoredAttribution(header);
    assert.deepEqual(stored.first, value);
    assert.deepEqual(stored.last, { utm_medium: "paid" });
    assert.deepEqual(parseAttributionCookie("not-json"), null);
  });
});
