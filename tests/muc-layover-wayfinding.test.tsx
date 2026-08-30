import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MucLayoverControls,
  MucLayoverResultPanel,
} from "@/app/components/muc-layover-wayfinding";
import { lookupMucLayover } from "@/lib/muc-layovers";

function leadOrder(html: string, first: string, second: string) {
  const a = html.indexOf(first);
  const b = html.indexOf(second);
  assert.ok(a >= 0 && b > a, `"${first}" must lead "${second}"`);
}

describe("MucLayoverResultPanel", () => {
  it("renders T2 G → satellite as minutes, then trap, then hours", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-sat")} />,
    );
    assert.match(html, /~1 min/);
    assert.match(html, /cannot walk/i);
    assert.match(html, /04:00–24:00/);
    assert.match(html, /Stay airside — PTS/);
    assert.doesNotMatch(html, /Same-zone \/ airside PTS/);
    leadOrder(html, "~1 min", "cannot walk");
    leadOrder(html, "cannot walk", "T2–satellite PTS");
    leadOrder(html, "T2–satellite PTS", "Stay airside — PTS");
  });

  it("leads with the trap when walk time is not published — no unpublished hero", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-a", "t1-b")} />,
    );
    assert.match(html, /MCT are unpublished/);
    assert.doesNotMatch(html, />unpublished</);
    assert.doesNotMatch(html, /5–7/);
    assert.doesNotMatch(html, /06:00–23:00/);
    leadOrder(html, "MCT are unpublished", "Same-zone walk");
  });

  it("renders the Hall F reclear trap without invented minutes", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t1-f")} />,
    );
    assert.match(html, /Hall F/);
    assert.match(html, /Tel Aviv/);
    assert.match(html, /Reclear trap/);
    assert.doesNotMatch(html, />unpublished</);
    leadOrder(html, "Hall F", "Reclear trap");
  });

  it("renders T1 D → T2 G as minutes, SAS trap, then shuttle hours", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-d", "t2-g")} />,
    );
    assert.match(html, /5–7 min ride/);
    assert.match(html, /SAS checks in at T1 D, not T2/);
    assert.match(html, /T1–T2 shuttle 06:00–23:00/);
    assert.match(html, /Different-terminal transfer/);
    leadOrder(html, "5–7 min ride", "SAS checks in");
    leadOrder(html, "SAS checks in", "T1–T2 shuttle 06:00–23:00");
    leadOrder(html, "T1–T2 shuttle 06:00–23:00", "Different-terminal transfer");
    const sasAt = html.indexOf("SAS checks in");
    const shuttleAt = html.indexOf("5–7 min ride shuttle");
    assert.ok(sasAt >= 0 && shuttleAt > sasAt, "SAS must lead the shuttle sentence");
  });

  it("renders T2 G ↔ T2 H as trap-first unpublished passport control", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-h")} />,
    );
    assert.match(html, /Passport control/);
    assert.match(html, /Reclear trap/);
    assert.doesNotMatch(html, />unpublished</);
    assert.doesNotMatch(html, /5–7/);
    assert.doesNotMatch(html, /~1 min/);
    assert.doesNotMatch(html, /06:00–23:00/);
    leadOrder(html, "Passport control", "Reclear trap");
  });
});

describe("MucLayoverControls", () => {
  it("renders swap, gate-letter hint, chips, and a no-JS Show path", () => {
    const html = renderToStaticMarkup(
      <MucLayoverControls
        from="t2-g"
        to="t2-sat"
        onPairChange={() => {}}
        showSubmit
      />,
    );
    assert.match(html, /Swap I am at and I need/);
    assert.match(html, /letter on your gate is the zone/);
    assert.match(html, /T1 D → T2 G/);
    assert.match(html, /T2 G → satellite/);
    assert.match(html, /T2 G → T2 H/);
    assert.match(html, />Hall F</);
    assert.match(html, /Show path/);
  });

  it("hides Show path after hydration", () => {
    const html = renderToStaticMarkup(
      <MucLayoverControls
        from="t2-g"
        to="t2-sat"
        onPairChange={() => {}}
        showSubmit={false}
      />,
    );
    assert.match(html, /hidden/);
    assert.match(html, /Show path/);
  });
});
