import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_WHOP_COMPANY_ID } from "./whop-gate";
import {
  WHOP_PIXEL_SCRIPT_URL,
  getWhopPixelBizId,
  shouldTrackWhopSpaPage,
  trackWhopPageView,
  whopPixelInitScript,
} from "./whop-pixel";

describe("getWhopPixelBizId", () => {
  it("defaults to the HonestAirport company id when unset", () => {
    assert.equal(getWhopPixelBizId({}), DEFAULT_WHOP_COMPANY_ID);
    assert.equal(getWhopPixelBizId({ OTHER: "x" }), DEFAULT_WHOP_COMPANY_ID);
    assert.equal(DEFAULT_WHOP_COMPANY_ID, "biz_7f2K9NIDw78ErX");
  });

  it("no-ops when NEXT_PUBLIC_WHOP_BIZ_ID is an explicit empty string", () => {
    assert.equal(getWhopPixelBizId({ NEXT_PUBLIC_WHOP_BIZ_ID: "" }), null);
    assert.equal(getWhopPixelBizId({ NEXT_PUBLIC_WHOP_BIZ_ID: "   " }), null);
  });

  it("uses a provided public biz id", () => {
    assert.equal(
      getWhopPixelBizId({ NEXT_PUBLIC_WHOP_BIZ_ID: " biz_custom " }),
      "biz_custom",
    );
  });
});

describe("whopPixelInitScript", () => {
  it("scopes the default company and tracks page, not purchase/subscribe", () => {
    const script = whopPixelInitScript(DEFAULT_WHOP_COMPANY_ID);
    assert.match(script, /t\.whop\.tw/);
    assert.match(script, /whop\.setScope\("biz_7f2K9NIDw78ErX"\)/);
    assert.match(script, /whop\.track\("page"\)/);
    assert.doesNotMatch(script, /purchase/);
    assert.doesNotMatch(script, /subscribe/);
    assert.equal(WHOP_PIXEL_SCRIPT_URL, "https://t.whop.tw/s.js");
  });
});

describe("trackWhopPageView / SPA", () => {
  it("calls window.whop.track('page') when the stub is present", () => {
    const calls: unknown[][] = [];
    const previous = globalThis.window;
    // jsdom is not a dependency — install a minimal window for this case.
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        whop: {
          track: (...args: unknown[]) => {
            calls.push(args);
          },
        },
      },
    });
    try {
      trackWhopPageView();
      assert.deepEqual(calls, [["page"]]);
    } finally {
      if (previous === undefined) {
        // @ts-expect-error restore node (no DOM)
        delete globalThis.window;
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previous,
        });
      }
    }
  });

  it("skips the first App Router path (init snippet already tracked)", () => {
    assert.equal(shouldTrackWhopSpaPage(null, "/"), false);
    assert.equal(shouldTrackWhopSpaPage("/", "/"), false);
    assert.equal(shouldTrackWhopSpaPage("/", "/members"), true);
  });
});
