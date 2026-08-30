import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MUC_ALLOWED_MINUTES,
  MUC_CONNECTING_FLIGHTS_URL,
  MUC_PINS_T2_G,
  MUC_PINS_T2_H,
  MUC_PINS_T2_SAT,
  MUC_COMMON_CONNECTIONS,
  MUC_GATE_LETTER_HINT,
  MUC_MINUTES_NOT_PUBLISHED,
  MUC_PUBLISHED,
  MUC_ZONE_IDS,
  isMucLayoversIata,
  isMucLayoversEnabled,
  isMucZoneId,
  parseMucZoneId,
  lookupMucLayover,
  mucLayoverHoursLabel,
  mucLayoverMinutesLabel,
  mucPathTypeLabel,
} from "./muc-layovers";

describe("MUC layover gate", () => {
  it("is on for MUC by default and never for other airports", () => {
    assert.equal(isMucLayoversIata("FRA"), false);
    assert.equal(isMucLayoversIata("muc"), true);
    assert.equal(isMucLayoversEnabled("FRA"), false);
    assert.equal(isMucLayoversEnabled("FRA", "1"), false);
    assert.equal(isMucLayoversEnabled("MUC"), true);
    assert.equal(isMucLayoversEnabled("muc", undefined), true);
    assert.equal(isMucLayoversEnabled("MUC", "1"), true);
    assert.equal(isMucLayoversEnabled("MUC", "0"), false);
  });
});

describe("lookupMucLayover published pairs", () => {
  it("T2 G → T2 satellite is airside PTS with the published ~1 min", () => {
    const result = lookupMucLayover("t2-g", "t2-sat");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.pathLabel, "Stay airside — PTS");
    assert.equal(result.minutes, MUC_PUBLISHED.ptsRide);
    assert.match(result.trap, /cannot walk/i);
    assert.equal(result.hours.length, 1);
    assert.equal(
      mucLayoverHoursLabel(result.hours[0]!),
      `T2–satellite PTS ${MUC_PUBLISHED.ptsHours}, ${MUC_PUBLISHED.ptsFreq}`,
    );
    assert.equal(result.pinsNote, MUC_PINS_T2_SAT);
    assert.equal(result.sourceHref, MUC_CONNECTING_FLIGHTS_URL);
  });

  it("T2 H → T2 satellite uses the same published PTS fact", () => {
    const result = lookupMucLayover("t2-h", "t2-sat");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.minutes, MUC_PUBLISHED.ptsRide);
    assert.match(result.trap, /cannot walk/i);
    assert.equal(result.pinsNote, MUC_PINS_T2_SAT);
  });

  it("T2 satellite → T2 G is the same published PTS fact in reverse", () => {
    const result = lookupMucLayover("t2-sat", "t2-g");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.minutes, "~1 min");
    assert.match(result.trap, /PTS/i);
    assert.equal(result.pinsNote, MUC_PINS_T2_G);
  });

  it("T1 → T2 G is the published shuttle, not an invented MCT", () => {
    const result = lookupMucLayover("t1-a", "t2-g");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, MUC_PUBLISHED.shuttleRide);
    assert.match(result.trap, /23:00–06:00/);
    assert.equal(result.hours[0]?.window, MUC_PUBLISHED.shuttleHours);
    assert.doesNotMatch(result.minutes ?? "", /\b(15|20|25|30|40|60)\b/);
  });

  it("T1 → T2 H uses the same published shuttle minutes", () => {
    const result = lookupMucLayover("t1-a", "t2-h");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, MUC_PUBLISHED.shuttleRide);
    assert.match(result.trap, /23:00–06:00/);
    assert.equal(result.hours[0]?.window, MUC_PUBLISHED.shuttleHours);
    assert.equal(result.pinsNote, MUC_PINS_T2_H);
  });

  it("T1 → T2 satellite lists both published legs without summing them", () => {
    const result = lookupMucLayover("t1-c", "t2-sat");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, "5–7 min ride, then ~1 min PTS");
    assert.doesNotMatch(result.minutes ?? "", /6–8|8 min|total/i);
    assert.match(result.trap, /23:00–06:00/);
    assert.match(result.trap, /cannot walk/i);
    assert.equal(result.hours.length, 2);
    assert.equal(result.hours[0]?.window, MUC_PUBLISHED.shuttleHours);
    assert.equal(result.hours[1]?.window, MUC_PUBLISHED.ptsHours);
  });

  it("T1 D → T2 G leads with SAS, then the published 5–7 min shuttle", () => {
    const result = lookupMucLayover("t1-d", "t2-g");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, MUC_PUBLISHED.shuttleRide);
    assert.match(result.trap, /^SAS checks in at T1 D, not T2\./);
    assert.match(result.trap, /5–7 min ride shuttle \(06:00–23:00\)/);
    assert.ok(
      result.trap.indexOf("SAS") < result.trap.indexOf("5–7"),
      "SAS must lead the trap",
    );
    assert.equal(result.hours[0]?.window, MUC_PUBLISHED.shuttleHours);
    assert.equal(result.pinsNote, MUC_PINS_T2_G);
  });

  it("T1 D → T2 satellite keeps SAS first, shuttle hours, and a PTS sentence", () => {
    const result = lookupMucLayover("t1-d", "t2-sat");
    assert.equal(result.pathType, "different_terminal");
    assert.equal(result.minutes, "5–7 min ride, then ~1 min PTS");
    assert.match(result.trap, /^SAS checks in at T1 D, not T2\./);
    assert.match(result.trap, /5–7 min ride shuttle \(06:00–23:00\)/);
    assert.match(result.trap, /cannot walk/i);
    assert.ok(
      result.trap.indexOf("5–7") < result.trap.indexOf("cannot walk"),
      "PTS is an extra sentence after the shuttle",
    );
    assert.equal(result.hours.length, 2);
  });

  it("T2 G → T2 H is the unpublished passport-control pair", () => {
    const result = lookupMucLayover("t2-g", "t2-h");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.equal(mucLayoverMinutesLabel(result.minutes), MUC_MINUTES_NOT_PUBLISHED);
    assert.deepEqual(result.hours, []);
    assert.match(result.trap, /Passport control/i);
    assert.match(result.trap, /unpublished/i);
    assert.equal(result.pinsNote, MUC_PINS_T2_H);
  });

  it("T2 H → T2 G is the same unpublished passport pair in reverse", () => {
    const result = lookupMucLayover("t2-h", "t2-g");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.match(result.trap, /Passport control/i);
    assert.equal(result.pinsNote, MUC_PINS_T2_G);
  });

  it("same T2 pier stays unpublished walk, not a passport trap", () => {
    const g = lookupMucLayover("t2-g", "t2-g");
    const h = lookupMucLayover("t2-h", "t2-h");
    assert.equal(g.pathType, "same_zone");
    assert.equal(g.minutes, null);
    assert.deepEqual(g.hours, []);
    assert.doesNotMatch(g.trap, /Passport/);
    assert.equal(h.pathType, "same_zone");
    assert.equal(h.minutes, null);
    assert.doesNotMatch(h.trap, /Passport/);
  });

  it("T2 G → Hall F / TLV is a reclear trap with unpublished walk/MCT", () => {
    const result = lookupMucLayover("t2-g", "t1-f");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.equal(mucLayoverMinutesLabel(result.minutes), MUC_MINUTES_NOT_PUBLISHED);
    assert.match(result.trap, /Hall F/i);
    assert.match(result.trap, /Tel Aviv/i);
  });

  it("Hall F is never treated as an airside T1–T2 shuttle", () => {
    const result = lookupMucLayover("t1-f", "t2-g");
    assert.equal(result.pathType, "reclear");
    assert.equal(result.minutes, null);
    assert.doesNotMatch(JSON.stringify(result), /5–7/);
  });

  it("same T1 module with no published walk time stays unpublished", () => {
    const result = lookupMucLayover("t1-a", "t1-b");
    assert.equal(result.pathType, "same_zone");
    assert.equal(result.minutes, null);
    assert.equal(mucLayoverMinutesLabel(result.minutes), MUC_MINUTES_NOT_PUBLISHED);
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
    const result = lookupMucLayover("t2-g", "hbf");
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
        if (result.minutes === null) {
          assert.deepEqual(
            result.hours,
            [],
            `${from} → ${to} must not invent hours on an unpublished pair`,
          );
        }
      }
    }
  });

  it("path-type labels stay on the three published kinds", () => {
    assert.equal(mucPathTypeLabel("same_zone"), "Same-zone walk");
    assert.equal(mucPathTypeLabel("same_zone", { pts: true }), "Stay airside — PTS");
    assert.equal(mucPathTypeLabel("reclear"), "Reclear trap");
    assert.equal(
      mucPathTypeLabel("different_terminal"),
      "Different-terminal transfer",
    );
  });

  it("rejects unknown zone ids and aliases legacy t2 to T2 G", () => {
    assert.equal(isMucZoneId("t3"), false);
    assert.equal(isMucZoneId("t2"), false);
    assert.equal(isMucZoneId("t2-g"), true);
    assert.equal(isMucZoneId("t2-h"), true);
    assert.equal(parseMucZoneId("t1-f", "t2-g"), "t1-f");
    assert.equal(parseMucZoneId("nope", "t2-g"), "t2-g");
    assert.equal(parseMucZoneId(null, "t2-sat"), "t2-sat");
    assert.equal(parseMucZoneId("t2", "t2-sat"), "t2-g");
    assert.equal(lookupMucLayover(parseMucZoneId("t2", "t2-g"), "t2-sat").minutes, "~1 min");
  });

  it("common-connection chips stay on published or unpublished facts", () => {
    assert.match(MUC_GATE_LETTER_HINT, /letter on your gate/i);
    assert.match(MUC_GATE_LETTER_HINT, /G Schengen/);
    assert.match(MUC_GATE_LETTER_HINT, /F is landside/);
    assert.equal(MUC_COMMON_CONNECTIONS.length, 4);
    for (const chip of MUC_COMMON_CONNECTIONS) {
      const result = lookupMucLayover(chip.from, chip.to);
      assert.ok(
        MUC_ALLOWED_MINUTES.has(result.minutes),
        `${chip.label} invented minutes: ${result.minutes}`,
      );
    }
    assert.equal(lookupMucLayover("t1-d", "t2-g").trap.startsWith("SAS"), true);
    assert.equal(lookupMucLayover("t2-g", "t2-h").minutes, null);
    assert.equal(lookupMucLayover("t2-g", "t1-f").pathType, "reclear");
  });
});
