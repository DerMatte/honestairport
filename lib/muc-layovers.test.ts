import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MUC_ALLOWED_MINUTES,
  MUC_CONNECTING_FLIGHTS_URL,
  MUC_FIRST_CLASS_PINS,
  MUC_PUBLISHED,
  MUC_ZONE_IDS,
  isMucLayoversIata,
  isMucLayoversPreviewEnabled,
  isMucZoneId,
  parseMucZoneId,
  lookupMucLayover,
  mucLayoverMinutesLabel,
  mucPathTypeLabel,
} from "./muc-layovers";

describe("MUC layover preview gate", () => {
  it("never enables the widget for other airports", () => {
    assert.equal(isMucLayoversIata("FRA"), false);
    assert.equal(isMucLayoversIata("muc"), true);
    assert.equal(isMucLayoversPreviewEnabled("FRA", "1", "1"), false);
    assert.equal(isMucLayoversPreviewEnabled("MUC", "1", undefined), true);
    assert.equal(isMucLayoversPreviewEnabled("muc", null, "1"), true);
    assert.equal(isMucLayoversPreviewEnabled("MUC", null, undefined), false);
    assert.equal(isMucLayoversPreviewEnabled("MUC", "0", "0"), false);
  });
});

describe("lookupMucLayover published pairs", () => {
  it("T2 → T2 satellite is airside PTS with the published ~1 min", () => {
    const result = lookupMucLayover("t2", "t2-sat");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.pathLabel, "Same-zone / airside PTS");
    assert.equal(result.minutes, MUC_PUBLISHED.ptsRide);
    assert.match(result.trap, /cannot walk/i);
    assert.equal(result.pinsNote, MUC_FIRST_CLASS_PINS);
    assert.equal(result.sourceHref, MUC_CONNECTING_FLIGHTS_URL);
  });

  it("T2 satellite → T2 is the same published PTS fact in reverse", () => {
    const result = lookupMucLayover("t2-sat", "t2");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.minutes, "~1 min");
    assert.match(result.trap, /PTS/i);
  });

  it("T1 → T2 is the published shuttle, not an invented MCT", () => {
    const result = lookupMucLayover("t1-a", "t2");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, MUC_PUBLISHED.shuttleRide);
    assert.match(result.trap, /23:00–06:00/);
    assert.doesNotMatch(result.minutes ?? "", /\b(15|20|25|30|40|60)\b/);
  });

  it("T1 → T2 satellite lists both published legs without summing them", () => {
    const result = lookupMucLayover("t1-c", "t2-sat");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, "5–7 min ride, then ~1 min PTS");
    assert.doesNotMatch(result.minutes ?? "", /6–8|8 min|total/i);
    assert.match(result.trap, /23:00–06:00/);
    assert.match(result.trap, /cannot walk/i);
  });

  it("T2 → Hall F / TLV is a reclear trap with unpublished walk/MCT", () => {
    const result = lookupMucLayover("t2", "t1-f");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.equal(mucLayoverMinutesLabel(result.minutes), "unpublished");
    assert.match(result.trap, /Hall F/i);
    assert.match(result.trap, /Tel Aviv/i);
  });

  it("Hall F is never treated as an airside T1–T2 shuttle", () => {
    const result = lookupMucLayover("t1-f", "t2");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.doesNotMatch(JSON.stringify(result), /5–7/);
  });

  it("same T1 module with no published walk time stays unpublished", () => {
    const result = lookupMucLayover("t1-a", "t1-b");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.minutes, null);
    assert.equal(mucLayoverMinutesLabel(result.minutes), "unpublished");
  });

  it("T1 D mentions the published SAS check-in trap", () => {
    const result = lookupMucLayover("t1-a", "t1-d");
    assert.equal(result.minutes, null);
    assert.match(result.trap, /SAS checks in at T1 D/);
  });

  it("T1 module → T1 Pier is a reclear / passport trap without invented minutes", () => {
    const result = lookupMucLayover("t1-d", "t1-pier");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.match(result.trap, /21 April 2026/);
  });

  it("airport → München Hbf uses the published S-Bahn time only", () => {
    const result = lookupMucLayover("t2", "hbf");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, MUC_PUBLISHED.sbahnToHbf);
    assert.match(result.trap, /Level 02/);
  });
});

describe("lookupMucLayover never invents minutes", () => {
  it("every origin/destination pair uses an allowlisted minutes string", () => {
    for (const from of MUC_ZONE_IDS) {
      for (const to of MUC_ZONE_IDS) {
        const result = lookupMucLayover(from, to);
        assert.ok(
          MUC_ALLOWED_MINUTES.has(result.minutes),
          `${from} → ${to} invented minutes: ${result.minutes}`,
        );
        assert.equal(result.from, from);
        assert.equal(result.to, to);
        assert.equal(result.sourceHref, MUC_CONNECTING_FLIGHTS_URL);
      }
    }
  });

  it("path-type labels stay on the three published kinds", () => {
    assert.equal(mucPathTypeLabel("same_zone"), "Same-zone walk");
    assert.equal(
      mucPathTypeLabel("same_zone", { pts: true }),
      "Same-zone / airside PTS",
    );
    assert.equal(mucPathTypeLabel("reclear"), "Reclear trap");
    assert.equal(
      mucPathTypeLabel("different_terminal"),
      "Different-terminal transfer",
    );
  });

  it("rejects unknown zone ids", () => {
    assert.equal(isMucZoneId("t3"), false);
    assert.equal(isMucZoneId("t2"), true);
    assert.equal(parseMucZoneId("t1-f", "t2"), "t1-f");
    assert.equal(parseMucZoneId("nope", "t2"), "t2");
    assert.equal(parseMucZoneId(null, "t2-sat"), "t2-sat");
  });
});
