import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareSearchHref,
  firstSearchParam,
  parseCompareIata,
  parseCompareSearchParams,
  serializeCompareSearchParams,
} from "./compare-search-params";

describe("parseCompareIata", () => {
  it("normalizes valid codes to uppercase", () => {
    assert.deepEqual(parseCompareIata("lga"), { kind: "ok", iata: "LGA" });
    assert.deepEqual(parseCompareIata("SIN"), { kind: "ok", iata: "SIN" });
    assert.deepEqual(parseCompareIata("  jfk  "), { kind: "ok", iata: "JFK" });
  });

  it("treats missing or blank values as empty", () => {
    assert.deepEqual(parseCompareIata(null), { kind: "empty" });
    assert.deepEqual(parseCompareIata(undefined), { kind: "empty" });
    assert.deepEqual(parseCompareIata(""), { kind: "empty" });
    assert.deepEqual(parseCompareIata("   "), { kind: "empty" });
  });

  it("rejects values that are not a 3-letter IATA code", () => {
    assert.deepEqual(parseCompareIata("lg"), { kind: "invalid", raw: "lg" });
    assert.deepEqual(parseCompareIata("LGAA"), { kind: "invalid", raw: "LGAA" });
    assert.deepEqual(parseCompareIata("12A"), { kind: "invalid", raw: "12A" });
    assert.deepEqual(parseCompareIata("LG-"), { kind: "invalid", raw: "LG-" });
  });
});

describe("parseCompareSearchParams", () => {
  it("reads a shared LGA vs SIN URL case-insensitively", () => {
    const parsed = parseCompareSearchParams(new URLSearchParams("a=lga&b=SIN"));
    assert.deepEqual(parsed, {
      a: { kind: "ok", iata: "LGA" },
      b: { kind: "ok", iata: "SIN" },
    });
  });

  it("keeps one-sided and invalid params instead of throwing", () => {
    const parsed = parseCompareSearchParams(new URLSearchParams("a=nope"));
    assert.deepEqual(parsed.a, { kind: "invalid", raw: "nope" });
    assert.deepEqual(parsed.b, { kind: "empty" });
  });
});

describe("serializeCompareSearchParams", () => {
  it("writes lowercase query values for shareable URLs", () => {
    const params = serializeCompareSearchParams("LGA", "sin");
    assert.equal(params.get("a"), "lga");
    assert.equal(params.get("b"), "sin");
  });

  it("omits empty sides and preserves invalid raw values", () => {
    const empty = serializeCompareSearchParams(null, null);
    assert.equal(empty.toString(), "");

    const invalid = serializeCompareSearchParams("nope", undefined);
    assert.equal(invalid.get("a"), "nope");
    assert.equal(invalid.has("b"), false);
  });
});

describe("compareSearchHref", () => {
  it("builds the canonical compare URL", () => {
    assert.equal(compareSearchHref("LGA", "SIN"), "/compare?a=lga&b=sin");
    assert.equal(compareSearchHref("LGA", null), "/compare?a=lga");
    assert.equal(compareSearchHref(null, null), "/compare");
  });
});

describe("firstSearchParam", () => {
  it("takes the first value from string or string[]", () => {
    assert.equal(firstSearchParam("lga"), "lga");
    assert.equal(firstSearchParam(["lga", "jfk"]), "lga");
    assert.equal(firstSearchParam([]), null);
    assert.equal(firstSearchParam(undefined), null);
  });
});
