import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MucLayoverResultPanel } from "@/app/components/muc-layover-wayfinding";
import { lookupMucLayover } from "@/lib/muc-layovers";

function leadOrder(html: string, first: string, second: string) {
  const a = html.indexOf(first);
  const b = html.indexOf(second);
  assert.ok(a >= 0 && b > a, `"${first}" must lead "${second}"`);
}

describe("MucLayoverResultPanel", () => {
  it("renders the T2 G → satellite published PTS result", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-sat")} />,
    );
    assert.match(html, /~1 min/);
    assert.match(html, /04:00–24:00/);
    assert.match(html, /cannot walk/i);
    assert.match(html, /Same-zone \/ airside PTS/);
    assert.doesNotMatch(html, /unpublished/);
    leadOrder(html, "~1 min", "cannot walk");
    leadOrder(html, "cannot walk", "Same-zone / airside PTS");
  });

  it("prints unpublished when no walk time exists, without fake hours", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-a", "t1-b")} />,
    );
    assert.match(html, /unpublished/);
    assert.match(html, /MCT are unpublished/);
    assert.doesNotMatch(html, /5–7/);
    assert.doesNotMatch(html, /06:00–23:00/);
    assert.doesNotMatch(html, /04:00–24:00/);
    leadOrder(html, "unpublished", "MCT are unpublished");
    leadOrder(html, "MCT are unpublished", "Same-zone walk");
  });

  it("renders the Hall F reclear trap without invented minutes", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t1-f")} />,
    );
    assert.match(html, /unpublished/);
    assert.match(html, /Hall F/);
    assert.match(html, /Tel Aviv/);
    assert.match(html, /Reclear trap/);
    leadOrder(html, "unpublished", "Hall F");
    leadOrder(html, "Hall F", "Reclear trap");
  });

  it("renders T1 D → T2 G with SAS leading the trap and the published shuttle", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-d", "t2-g")} />,
    );
    assert.match(html, /5–7 min ride/);
    assert.match(html, /06:00–23:00/);
    assert.match(html, /SAS checks in at T1 D, not T2/);
    assert.match(html, /Different-terminal transfer/);
    leadOrder(html, "5–7 min ride", "SAS checks in");
    leadOrder(html, "SAS checks in", "Different-terminal transfer");
    const sasAt = html.indexOf("SAS checks in");
    const shuttleAt = html.indexOf("5–7 min ride shuttle");
    assert.ok(sasAt >= 0 && shuttleAt > sasAt, "SAS must lead the shuttle sentence");
  });

  it("renders T2 G ↔ T2 H as unpublished passport control", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-h")} />,
    );
    assert.match(html, /unpublished/);
    assert.match(html, /Passport control/);
    assert.match(html, /Reclear trap/);
    assert.doesNotMatch(html, /5–7/);
    assert.doesNotMatch(html, /~1 min/);
    assert.doesNotMatch(html, /06:00–23:00/);
    leadOrder(html, "unpublished", "Passport control");
    leadOrder(html, "Passport control", "Reclear trap");
  });
});
