import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickTransportRecommendations } from "./airport-utils";
import type { TransportOption } from "./types";

function option(overrides: Partial<TransportOption> & Pick<TransportOption, "type" | "name">): TransportOption {
  return {
    summary: "A way into the city.",
    timeToCity: "35-45 min",
    cost: "$$",
    insiderTip: "Leave extra time.",
    ...overrides,
  };
}

describe("pickTransportRecommendations", () => {
  it("skips options with a missing timeToCity instead of throwing", () => {
    const incomplete = option({
      type: "train",
      name: "AirTrain",
      timeToCity: undefined as unknown as string,
    });
    const taxi = option({
      type: "taxi",
      name: "Taxi",
      timeToCity: "25 min",
      cost: "$$$",
    });

    const picks = pickTransportRecommendations([incomplete, taxi]);
    assert.equal(picks.fastest?.name, "Taxi");
    assert.equal(picks.cheapest?.name, "AirTrain");
  });
});
