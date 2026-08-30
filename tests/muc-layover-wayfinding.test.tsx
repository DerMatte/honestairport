import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MucLayoverResultPanel } from "@/app/components/muc-layover-wayfinding";
import { lookupMucLayover } from "@/lib/muc-layovers";

describe("MucLayoverResultPanel", () => {
  it("renders the T2 → satellite published PTS result", () => {
    const html = renderToStaticMarkup(
      <MucLayoverResultPanel result={lookupMucLayover("t2", "t2-sat")} />,
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
      <MucLayoverResultPanel result={lookupMucLayover("t2", "t1-f")} />,
    );
    assert.match(html, /Reclear trap/);
    assert.match(html, /unpublished/);
    assert.match(html, /Hall F/);
    assert.match(html, /Tel Aviv/);
  });
});
