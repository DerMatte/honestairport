import { getAirportByIata } from "@/lib/airports";
import {
  getAirportContent,
  getAirportLoungesWithFallback,
  getAirportProfile,
} from "@/lib/airport-content";
import { searchAirports, type AirportSearchEntry } from "@/lib/airport-search";
import { getMajorAirportCandidates } from "@/lib/major-airports";
import {
  loadAirportPageMarkdown,
  loadLoungePageMarkdown,
} from "@/lib/public-markdown";

export const SEARCH_AIRPORTS_LIMIT = 10;
export const MAJOR_AIRPORTS_DEFAULT_LIMIT = 100;

export type McpTextResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

export type McpAirportHit = {
  iata: string;
  name: string;
  city: string;
  country: string;
};

export function parseIataCode(value: string): string | null {
  const iata = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(iata) ? iata : null;
}

export function mcpTextResult(text: string): McpTextResult {
  return { content: [{ type: "text", text }] };
}

export function mcpJsonResult(value: unknown): McpTextResult {
  return mcpTextResult(`${JSON.stringify(value, null, 2)}\n`);
}

export function mcpNotFound(message: string): McpTextResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Not found: ${message}` }],
  };
}

export function toMcpAirportHits(
  airports: ReadonlyArray<Pick<AirportSearchEntry, "iata" | "name" | "city" | "country">>,
  limit = SEARCH_AIRPORTS_LIMIT,
): McpAirportHit[] {
  return airports.slice(0, limit).map((airport) => ({
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    country: airport.country,
  }));
}

export async function airportExists(iata: string): Promise<boolean> {
  if (getAirportByIata(iata)) {
    return true;
  }
  const [guide, profile] = await Promise.all([
    getAirportContent(iata),
    getAirportProfile(iata),
  ]);
  return Boolean(guide || profile);
}

export async function executeSearchAirports(query: string): Promise<McpTextResult> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return {
      isError: true,
      content: [{ type: "text", text: "query must not be empty" }],
    };
  }

  const results = await searchAirports(trimmed, undefined, {
    limit: SEARCH_AIRPORTS_LIMIT,
  });
  return mcpJsonResult({
    query: trimmed,
    airports: toMcpAirportHits(results.airports, SEARCH_AIRPORTS_LIMIT),
  });
}

export async function executeGetAirport(iataInput: string): Promise<McpTextResult> {
  const iata = parseIataCode(iataInput);
  if (!iata) {
    return {
      isError: true,
      content: [{ type: "text", text: "Use a three-letter IATA code" }],
    };
  }

  const markdown = await loadAirportPageMarkdown(iata.toLowerCase());
  if (!markdown) {
    return mcpNotFound(`unknown IATA ${iata}`);
  }
  return mcpTextResult(markdown);
}

export async function executeListLounges(iataInput: string): Promise<McpTextResult> {
  const iata = parseIataCode(iataInput);
  if (!iata) {
    return {
      isError: true,
      content: [{ type: "text", text: "Use a three-letter IATA code" }],
    };
  }

  if (!(await airportExists(iata))) {
    return mcpNotFound(`unknown IATA ${iata}`);
  }

  const lounges = await getAirportLoungesWithFallback(iata);
  return mcpJsonResult({
    iata,
    lounges: lounges
      .filter((lounge) => lounge.slug)
      .map((lounge) => ({
        name: lounge.name,
        slug: lounge.slug,
        terminal: lounge.terminal,
        status: lounge.status,
      })),
  });
}

export async function executeGetLounge(
  iataInput: string,
  loungeSlugInput: string,
): Promise<McpTextResult> {
  const iata = parseIataCode(iataInput);
  if (!iata) {
    return {
      isError: true,
      content: [{ type: "text", text: "Use a three-letter IATA code" }],
    };
  }

  const loungeSlug = loungeSlugInput.trim();
  if (!loungeSlug) {
    return {
      isError: true,
      content: [{ type: "text", text: "lounge slug is required" }],
    };
  }

  const markdown = await loadLoungePageMarkdown(iata.toLowerCase(), loungeSlug);
  if (!markdown) {
    return mcpNotFound(
      `unknown lounge ${loungeSlug} at ${iata}`,
    );
  }
  return mcpTextResult(markdown);
}

export function executeListMajorAirports(limit?: number): McpTextResult {
  const cap =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.min(MAJOR_AIRPORTS_DEFAULT_LIMIT, Math.max(1, Math.floor(limit)))
      : MAJOR_AIRPORTS_DEFAULT_LIMIT;

  return mcpJsonResult({
    airports: getMajorAirportCandidates()
      .slice(0, cap)
      .map((airport) => ({
        rank: airport.rank,
        iata: airport.iata,
        name: airport.name,
        city: airport.city,
        country: airport.country,
      })),
  });
}

export type PaidMcpToolCall = {
  name: "get_lounge";
  iata: string;
  loungeSlug: string;
  segments: readonly ["airports", string, "lounge", string];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function toolCallNameAndArgs(
  body: unknown,
): { name: string; args: Record<string, unknown> } | null {
  const root = asRecord(body);
  if (!root) {
    return null;
  }

  const method = typeof root.method === "string" ? root.method : "";
  if (method !== "tools/call") {
    return null;
  }

  const params = asRecord(root.params);
  if (!params || typeof params.name !== "string") {
    return null;
  }

  return {
    name: params.name,
    args: asRecord(params.arguments) ?? {},
  };
}

/**
 * Peek at an MCP JSON-RPC body for x402-gated tool calls.
 * Only `get_lounge` is paid. `get_airport` is token-only and never 402s.
 */
export function parsePaidMcpToolCall(body: unknown): PaidMcpToolCall | null {
  const call = toolCallNameAndArgs(body);
  if (!call || call.name !== "get_lounge") {
    return null;
  }

  const iata = typeof call.args.iata === "string" ? parseIataCode(call.args.iata) : null;
  const loungeSlug =
    typeof call.args.slug === "string"
      ? call.args.slug.trim()
      : typeof call.args.loungeSlug === "string"
        ? call.args.loungeSlug.trim()
        : "";
  if (!iata || !loungeSlug) {
    return null;
  }
  return {
    name: "get_lounge",
    iata,
    loungeSlug,
    segments: ["airports", iata.toLowerCase(), "lounge", loungeSlug],
  };
}

export async function loadPaidToolMarkdown(
  paid: PaidMcpToolCall,
): Promise<string | null> {
  switch (paid.name) {
    case "get_lounge":
      return loadLoungePageMarkdown(paid.iata.toLowerCase(), paid.loungeSlug);
    default: {
      const _exhaustive: never = paid;
      return _exhaustive;
    }
  }
}
