import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAirportByIata, isPassengerAirportName } from "./airports";
import {
  DEFAULT_GENERATION_BATCH_SIZE,
  getNextMissingForGeneration,
  listGenerationPriorityAirports,
  listGenerationPriorityIatas,
  PRIORITY_COUNTRY_CODES,
  TIER2_CURATED_IATAS,
} from "./airport-generation-priority";
import { MAJOR_AIRPORTS_BY_RANK } from "./major-airports";

describe("airport generation priority", () => {
  const priority = listGenerationPriorityAirports();
  const byTier = {
    1: priority.filter((airport) => airport.tier === 1),
    2: priority.filter((airport) => airport.tier === 2),
    3: priority.filter((airport) => airport.tier === 3),
  };

  it("lists missing majors first, then curated tier 2", () => {
    const next = getNextMissingForGeneration(new Set(), 3);
    assert.deepEqual(
      next.map((airport) => airport.iata),
      ["ATL", "DXB", "DFW"],
    );
    assert.ok(next.every((airport) => airport.tier === 1));

    const afterMajors = getNextMissingForGeneration(
      new Set(MAJOR_AIRPORTS_BY_RANK.map((airport) => airport.iata)),
      3,
    );
    assert.equal(afterMajors.length, 3);
    assert.ok(afterMajors.every((airport) => airport.tier === 2));
    assert.deepEqual(
      afterMajors.map((airport) => airport.iata),
      byTier[2].slice(0, 3).map((airport) => airport.iata),
    );
    assert.equal(afterMajors[0]?.iata, "FLL");
  });

  it("skips known-covered IATAs and continues in list order", () => {
    const skipMajors = getNextMissingForGeneration(new Set(["ATL", "dxb"]), 2);
    assert.deepEqual(
      skipMajors.map((airport) => airport.iata),
      ["DFW", "LHR"],
    );

    const covered = new Set([
      ...MAJOR_AIRPORTS_BY_RANK.map((airport) => airport.iata),
      byTier[2][0]!.iata,
      byTier[2][1]!.iata,
    ]);
    const next = getNextMissingForGeneration(covered, 1);
    assert.equal(next[0]?.iata, byTier[2][2]?.iata);
    assert.equal(next[0]?.tier, 2);
  });

  it("keeps ACI top 100 as the tier-1 source of truth", () => {
    const majorIatas = MAJOR_AIRPORTS_BY_RANK.map((airport) => airport.iata);
    assert.deepEqual(
      byTier[1].map((airport) => airport.iata),
      majorIatas,
    );
    assert.equal(byTier[1].length, 100);
    assert.equal(priority.find((airport) => airport.iata === "GLA")?.tier, 1);
  });

  it("resolves a ~100-airport tier-2 wave and drops unknowns / non-passenger names", () => {
    assert.ok(TIER2_CURATED_IATAS.length >= 90 && TIER2_CURATED_IATAS.length <= 120);
    assert.equal(byTier[2].length, TIER2_CURATED_IATAS.length);

    for (const iata of TIER2_CURATED_IATAS) {
      const record = getAirportByIata(iata);
      assert.ok(record, `tier-2 IATA ${iata} must exist in airports.json`);
      assert.equal(isPassengerAirportName(record.name), true);
    }

    const tier2Iatas = new Set(byTier[2].map((airport) => airport.iata));
    for (const example of ["NUE", "STR", "FLL", "IAD", "DCA", "HER", "RHO", "IBZ", "JTR", "JMK"]) {
      assert.ok(tier2Iatas.has(example), `expected ${example} in tier 2`);
    }
    assert.equal(tier2Iatas.has("GLA"), false);
  });

  it("never includes military or heliport-only fields", () => {
    for (const airport of priority) {
      assert.equal(
        isPassengerAirportName(airport.name),
        true,
        `${airport.iata} ${airport.name} should be a passenger airport`,
      );
      assert.ok(getAirportByIata(airport.iata));
    }

    const iatas = new Set(listGenerationPriorityIatas());
    assert.equal(iatas.has("LTS"), false);
    assert.equal(iatas.has("BAD"), false);
    assert.equal(iatas.has("FRN"), false);
  });

  it("keeps a unique, deterministic pick order across tiers", () => {
    const iatas = listGenerationPriorityIatas();
    assert.equal(iatas.length, new Set(iatas).size);
    assert.deepEqual(iatas, listGenerationPriorityIatas());

    const lastTier1 = iatas.lastIndexOf(byTier[1].at(-1)!.iata);
    const firstTier2 = iatas.indexOf(byTier[2][0]!.iata);
    const lastTier2 = iatas.lastIndexOf(byTier[2].at(-1)!.iata);
    const firstTier3 = iatas.indexOf(byTier[3][0]!.iata);
    assert.ok(lastTier1 < firstTier2);
    assert.ok(lastTier2 < firstTier3);

    const countryRank = new Map(PRIORITY_COUNTRY_CODES.map((code, index) => [code, index]));
    let previousRank = -1;
    for (const airport of byTier[3]) {
      const rank = countryRank.get(airport.country as (typeof PRIORITY_COUNTRY_CODES)[number]);
      assert.notEqual(rank, undefined, `${airport.iata} country ${airport.country} is not a priority country`);
      assert.ok(rank! >= previousRank);
      previousRank = rank!;
    }

    assert.equal(byTier[3][0]?.country, "DE");
    assert.equal(DEFAULT_GENERATION_BATCH_SIZE, 10);
    assert.deepEqual(getNextMissingForGeneration(new Set(), 0), []);
  });
});
