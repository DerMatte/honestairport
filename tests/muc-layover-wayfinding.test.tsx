import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MucLayoverResultPanel } from "@/app/components/muc-layover-wayfinding";
import { lookupMucLayover } from "@/lib/muc-layovers";

describe("MucLayoverResultPanel", () => {
  it("renders the T2 G → satellite published PTS result", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-sat")} />,
    );
    assert.match(html, /Same-zone \/ airside PTS/);
    assert.match(html, /~1 min/);
    assert.match(html, /cannot walk/i);
    assert.doesNotMatch(html, /unpublished/);
  });

  it("prints unpublished when no walk time exists", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-a", "t1-b")} />,
    );
    assert.match(html, /unpublished/);
    assert.match(html, /MCT are unpublished/);
    assert.doesNotMatch(html, /5–7/);
  });

  it("renders the Hall F reclear trap without invented minutes", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t1-f")} />,
    );
    assert.match(html, /Reclear trap/);
    assert.match(html, /unpublished/);
    assert.match(html, /Hall F/);
    assert.match(html, /Tel Aviv/);
  });

  it("renders T1 D → T2 G with SAS leading the trap and the published shuttle", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t1-d", "t2-g")} />,
    );
    assert.match(html, /Different-terminal transfer/);
    assert.match(html, /5–7 min ride/);
    assert.match(html, /SAS checks in at T1 D, not T2/);
    assert.match(html, /No connecting shuttle 23:00–06:00/);
    const sasAt = html.indexOf("SAS checks in");
    const shuttleAt = html.indexOf("No connecting shuttle");
    assert.ok(sasAt >= 0 && shuttleAt > sasAt, "SAS must lead the night-shuttle line");
  });

  it("renders T2 G ↔ T2 H as unpublished passport control", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2-g", "t2-h")} />,
    );
    assert.match(html, /Reclear trap/);
    assert.match(html, /unpublished/);
    assert.match(html, /Passport control/);
    assert.doesNotMatch(html, /5–7/);
    assert.doesNotMatch(html, /~1 min/);
  });
});
