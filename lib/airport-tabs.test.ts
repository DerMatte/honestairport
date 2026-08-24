import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAirportTabMarkdownSlug,
  isAirportTabValue,
  isFreeAirportTab,
  isPaidAirportTab,
} from "./airport-tabs";

describe("airport tab paywall helpers", () => {
  it("treats overview and the lounges list as free", () => {
    assert.equal(isFreeAirportTab("overview"), true);
    assert.equal(isFreeAirportTab("lounges"), true);
    assert.equal(isPaidAirportTab("overview"), false);
    assert.equal(isPaidAirportTab("lounges"), false);
  });

  it("treats the other airport tabs as paid", () => {
    for (const tab of [
      "getting-there",
      "amenities",
      "tips",
      "water",
      "guide",
      "disruptions",
      "reviews",
    ]) {
      assert.equal(isPaidAirportTab(tab), true, tab);
      assert.equal(isFreeAirportTab(tab), false, tab);
      assert.equal(isAirportTabMarkdownSlug(tab), true, tab);
    }
  });

  it("does not treat overview or lounge pages as tab markdown slugs", () => {
    assert.equal(isAirportTabMarkdownSlug("overview"), false);
    assert.equal(isAirportTabValue("lounge"), false);
    assert.equal(isAirportTabMarkdownSlug("lounge"), false);
  });
});
