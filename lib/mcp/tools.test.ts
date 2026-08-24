import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAirportByIata } from "@/lib/airports";
import { getMajorAirportCandidates } from "@/lib/major-airports";
import {
  executeListMajorAirports,
  mcpNotFound,
  parseIataCode,
  parsePaidMcpToolCall,
  toMcpAirportHits,
} from "./tools";

describe("parseIataCode", () => {
  it("normalizes a three-letter code and rejects junk", () => {
    assert.equal(parseIataCode("lax"), "LAX");
    assert.equal(parseIataCode(" LAX "), "LAX");
    assert.equal(parseIataCode("LA"), null);
    assert.equal(parseIataCode("LAXX"), null);
    assert.equal(parseIataCode("12A"), null);
    assert.equal(parseIataCode(""), null);
  });
});

describe("toMcpAirportHits", () => {
  it("caps results and returns only iata/name/city/country", () => {
    const hits = toMcpAirportHits(
      [
        {
          iata: "LAX",
          name: "Los Angeles International Airport",
          city: "Los Angeles",
          country: "United States",
        },
        {
          iata: "BUR",
          name: "Hollywood Burbank Airport",
          city: "Burbank",
          country: "United States",
        },
        {
          iata: "SNA",
          name: "John Wayne Airport",
          city: "Santa Ana",
          country: "United States",
        },
      ],
      2,
    );

    assert.equal(hits.length, 2);
    assert.deepEqual(hits[0], {
      iata: "LAX",
      name: "Los Angeles International Airport",
      city: "Los Angeles",
      country: "United States",
    });
    assert.equal("score" in hits[0], false);
    assert.equal(hits[1].iata, "BUR");
  });
});

describe("unknown IATA tool errors", () => {
  it("uses a 404-style tool error payload", () => {
    const result = mcpNotFound("unknown IATA ZZZ");
    assert.equal(result.isError, true);
    assert.equal(result.content[0]?.text, "Not found: unknown IATA ZZZ");
  });

  it("does not treat a made-up IATA as a catalog airport", () => {
    assert.equal(getAirportByIata("ZZZ"), undefined);
    assert.ok(getAirportByIata("LAX"));
  });
});

describe("parsePaidMcpToolCall", () => {
  it("extracts get_lounge and never treats get_airport as paid", () => {
    assert.equal(
      parsePaidMcpToolCall({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "get_airport", arguments: { iata: "lax" } },
      }),
      null,
    );
    assert.deepEqual(
      parsePaidMcpToolCall({
        method: "tools/call",
        params: {
          name: "get_lounge",
          arguments: { iata: "LAX", slug: "star-alliance" },
        },
      }),
      {
        name: "get_lounge",
        iata: "LAX",
        loungeSlug: "star-alliance",
        segments: ["airports", "lax", "lounge", "star-alliance"],
      },
    );
  });

  it("leaves search and list tools unpaid", () => {
    assert.equal(
      parsePaidMcpToolCall({
        method: "tools/call",
        params: { name: "search_airports", arguments: { query: "lax" } },
      }),
      null,
    );
    assert.equal(
      parsePaidMcpToolCall({
        method: "tools/call",
        params: { name: "list_lounges", arguments: { iata: "LAX" } },
      }),
      null,
    );
    assert.equal(
      parsePaidMcpToolCall({
        method: "tools/list",
      }),
      null,
    );
  });
});

describe("list_major_airports", () => {
  it("returns ranked majors from the static catalog", () => {
    const result = executeListMajorAirports(3);
    assert.equal(result.isError, undefined);
    const parsed = JSON.parse(result.content[0].text) as {
      airports: Array<{ rank: number; iata: string; name: string }>;
    };
    const expected = getMajorAirportCandidates().slice(0, 3);
    assert.equal(parsed.airports.length, 3);
    assert.equal(parsed.airports[0].iata, expected[0].iata);
    assert.equal(parsed.airports[0].rank, 1);
    assert.ok(parsed.airports[0].name.length > 0);
  });
});
