/**
 * Shareable `/compare?a=&b=` helpers.
 *
 * IATA codes are uppercase in the UI and lowercase in the query, matching
 * airport page slugs (`/airports/lga`).
 */

export const COMPARE_SEARCH_PARAM_KEYS = ["a", "b"] as const;

const IATA_CODE = /^[A-Za-z]{3}$/;

export type CompareIataParam =
  | { kind: "empty" }
  | { kind: "invalid"; raw: string }
  | { kind: "ok"; iata: string };

type SearchParamReader = Pick<URLSearchParams, "get">;

export function firstSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function parseCompareIata(
  raw: string | null | undefined,
): CompareIataParam {
  if (raw == null) return { kind: "empty" };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };
  if (!IATA_CODE.test(trimmed)) {
    return { kind: "invalid", raw: trimmed };
  }
  return { kind: "ok", iata: trimmed.toUpperCase() };
}

export function parseCompareSearchParams(params: SearchParamReader): {
  a: CompareIataParam;
  b: CompareIataParam;
} {
  return {
    a: parseCompareIata(params.get("a")),
    b: parseCompareIata(params.get("b")),
  };
}

export function serializeCompareSearchParams(
  a: string | null | undefined,
  b: string | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  const left = parseCompareIata(a);
  const right = parseCompareIata(b);

  if (left.kind === "ok") {
    params.set("a", left.iata.toLowerCase());
  } else if (left.kind === "invalid") {
    params.set("a", left.raw);
  }

  if (right.kind === "ok") {
    params.set("b", right.iata.toLowerCase());
  } else if (right.kind === "invalid") {
    params.set("b", right.raw);
  }

  return params;
}

export function compareSearchHref(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  const qs = serializeCompareSearchParams(a, b).toString();
  return qs ? `/compare?${qs}` : "/compare";
}

export function compareParamIata(
  param: CompareIataParam,
): string | null {
  return param.kind === "ok" ? param.iata : null;
}
