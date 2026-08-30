import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AIRPORT_TAB_VALUES,
  FREE_AIRPORT_TAB_VALUES,
  PAID_AIRPORT_TAB_VALUES,
  airportTabLabel,
  isAirportTabMarkdownSlug,
  isAirportTabValue,
  isFreeAirportTab,
  isPaidAirportTab,
  resolveAirportTab,
} from "./airport-tabs";

describe("airport tab paywall helpers", () => {
  it("treats overview, getting there, and the lounges list as free", () => {
    assert.deepEqual([...FREE_AIRPORT_TAB_VALUES], [
      "overview",
      "getting-there",
      "lounges",
    ]);
    for (const tab of FREE_AIRPORT_TAB_VALUES) {
      assert.equal(isFreeAirportTab(tab), true, tab);
      assert.equal(isPaidAirportTab(tab), false, tab);
    }
  });

  it("treats the remaining airport tabs as paid", () => {
    assert.ok(!PAID_AIRPORT_TAB_VALUES.includes("getting-there" as never));
    for (const tab of [
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
    assert.equal(isAirportTabMarkdownSlug("getting-there"), true);
    assert.equal(isAirportTabValue("lounge"), false);
    assert.equal(isAirportTabMarkdownSlug("lounge"), false);
  });

  it("covers every tab as exactly free or paid", () => {
    for (const tab of AIRPORT_TAB_VALUES) {
      assert.equal(
        isFreeAirportTab(tab) !== isPaidAirportTab(tab),
        true,
        tab,
      );
    }
  });
});

describe("resolveAirportTab", () => {
  const visible = ["overview", "getting-there", "lounges", "reviews"] as const;

  it("returns a visible requested tab", () => {
    assert.equal(resolveAirportTab("lounges", visible), "lounges");
    assert.equal(resolveAirportTab("getting-there", visible), "getting-there");
  });

  it("falls back to overview for invalid, missing, or hidden tabs", () => {
    assert.equal(resolveAirportTab(null, visible), "overview");
    assert.equal(resolveAirportTab(undefined, visible), "overview");
    assert.equal(resolveAirportTab("not-a-tab", visible), "overview");
    assert.equal(resolveAirportTab("water", visible), "overview");
    assert.equal(resolveAirportTab("overview", visible), "overview");
  });

  it("labels Getting There without a members suffix", () => {
    assert.equal(airportTabLabel("getting-there"), "Getting There");
    assert.equal(airportTabLabel("tips"), "Traveler Tips");
  });
});
