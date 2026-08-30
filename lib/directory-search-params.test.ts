import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DIRECTORY_FILTERS,
  clearDirectoryDataFilters,
  directoryFiltersEqual,
  directorySearchHref,
  directoryUrlSyncAction,
  hasDirectoryChipFilters,
  hasDirectoryDataFilters,
  parseDirectorySearchParams,
  serializeDirectorySearchParams,
} from "./directory-search-params";
import type { AirportFilters } from "./types";

function parseQuery(query: string): AirportFilters {
  return parseDirectorySearchParams(new URLSearchParams(query));
}

describe("parseDirectorySearchParams", () => {
  it("restores a shared country + sort URL", () => {
    const filters = parseQuery("q=Germany&scope=country&sort=highest-score");
    assert.deepEqual(filters, {
      ...DEFAULT_DIRECTORY_FILTERS,
      query: "Germany",
      searchScope: "country",
      sort: "highest-score",
    });
  });

  it("ignores invalid enum values and falls back to defaults", () => {
    const filters = parseQuery(
      "scope=planet&sort=popularity&regions=Atlantis,Europe&amenities=sauna,wifi&disruption=chaos,minor&score=nope",
    );
    assert.deepEqual(filters, {
      ...DEFAULT_DIRECTORY_FILTERS,
      regions: ["Europe"],
      amenities: ["wifi"],
      disruptionStatuses: ["minor"],
    });
  });

  it("drops scope when the query is empty", () => {
    const filters = parseQuery("scope=city");
    assert.equal(filters.searchScope, "all");
    assert.equal(filters.query, "");
  });

  it("clamps and rounds score, ignoring non-positive values", () => {
    assert.equal(parseQuery("score=7.5").minimumScore, 7.5);
    assert.equal(parseQuery("score=15").minimumScore, 10);
    assert.equal(parseQuery("score=-1").minimumScore, 0);
    assert.equal(parseQuery("score=0").minimumScore, 0);
  });

  it("canonicalizes list order and drops duplicates", () => {
    const filters = parseQuery(
      "regions=Africa,Europe,Europe&amenities=sleep,food&disruption=severe,normal",
    );
    assert.deepEqual(filters.regions, ["Europe", "Africa"]);
    assert.deepEqual(filters.amenities, ["food", "sleep"]);
    assert.deepEqual(filters.disruptionStatuses, ["normal", "severe"]);
  });
});

describe("serializeDirectorySearchParams", () => {
  it("omits default values", () => {
    const params = serializeDirectorySearchParams(DEFAULT_DIRECTORY_FILTERS);
    assert.equal(params.toString(), "");
  });

  it("writes only active filters", () => {
    const params = serializeDirectorySearchParams({
      query: "Germany",
      searchScope: "country",
      minimumScore: 7.5,
      regions: ["Europe"],
      amenities: ["wifi", "lounge"],
      disruptionStatuses: ["minor"],
      sort: "newest-guides",
    });
    assert.equal(params.get("q"), "Germany");
    assert.equal(params.get("scope"), "country");
    assert.equal(params.get("score"), "7.5");
    assert.equal(params.get("regions"), "Europe");
    assert.equal(params.get("amenities"), "lounge,wifi");
    assert.equal(params.get("disruption"), "minor");
    assert.equal(params.get("sort"), "newest-guides");
    assert.equal(params.has("highest-score"), false);
  });

  it("round-trips a fully populated filter set", () => {
    const filters: AirportFilters = {
      query: "Berlin",
      searchScope: "city",
      minimumScore: 8,
      regions: ["Europe", "Asia-Pacific"],
      amenities: ["family", "food"],
      disruptionStatuses: ["normal"],
      sort: "least-disruptions",
    };
    const parsed = parseDirectorySearchParams(serializeDirectorySearchParams(filters));
    assert.deepEqual(parsed, {
      ...filters,
      regions: ["Europe", "Asia-Pacific"],
      amenities: ["food", "family"],
    });
  });
});

describe("directorySearchHref", () => {
  it("builds a shareable homepage URL and preserves unrelated params", () => {
    const current = new URLSearchParams("utm_source=share");
    assert.equal(
      directorySearchHref(
        { ...DEFAULT_DIRECTORY_FILTERS, query: "Germany", searchScope: "country" },
        current,
      ),
      "/?utm_source=share&q=Germany&scope=country",
    );
    assert.equal(directorySearchHref(DEFAULT_DIRECTORY_FILTERS), "/");
  });
});

describe("directory filter helpers", () => {
  it("compares filters and clears only data filters", () => {
    const filters: AirportFilters = {
      query: "Germany",
      searchScope: "country",
      minimumScore: 6,
      regions: ["Europe"],
      amenities: ["wifi"],
      disruptionStatuses: ["minor"],
      sort: "most-reviewed",
    };

    assert.equal(directoryFiltersEqual(filters, { ...filters }), true);
    assert.equal(hasDirectoryDataFilters(filters), true);
    assert.equal(hasDirectoryChipFilters(filters), true);

    const cleared = clearDirectoryDataFilters(filters);
    assert.deepEqual(cleared, {
      ...DEFAULT_DIRECTORY_FILTERS,
      query: "Germany",
      searchScope: "country",
      sort: "most-reviewed",
    });
    assert.equal(hasDirectoryDataFilters(cleared), false);
    assert.equal(hasDirectoryChipFilters(cleared), true);
  });
});

describe("directoryUrlSyncAction", () => {
  it("applies the URL when no write is in flight", () => {
    assert.equal(
      directoryUrlSyncAction({
        incomingKey: "q=Germany",
        lastWrittenKey: "q=France",
        writeGeneration: 2,
        appliedGeneration: 2,
      }),
      "apply",
    );
  });

  it("ignores a stale URL while a newer write is in flight", () => {
    assert.equal(
      directoryUrlSyncAction({
        incomingKey: "q=a",
        lastWrittenKey: "q=ab",
        writeGeneration: 3,
        appliedGeneration: 2,
      }),
      "ignore",
    );
  });

  it("acknowledges the write that just landed", () => {
    assert.equal(
      directoryUrlSyncAction({
        incomingKey: "q=ab",
        lastWrittenKey: "q=ab",
        writeGeneration: 3,
        appliedGeneration: 2,
      }),
      "ack-write",
    );
  });
});
