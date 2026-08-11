import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildRideshareDeepLink,
  rideshareDeepLinkPrefillsRoute,
  type RideshareDropoffPoint,
  type RidesharePickupPoint,
} from "@/lib/rideshare";

const jfkPickup: RidesharePickupPoint = {
  latitude: 40.6413,
  longitude: -73.7781,
  nickname: "JFK",
  formattedAddress: "John F. Kennedy International Airport",
};

const nycDropoff: RideshareDropoffPoint = {
  latitude: 40.758,
  longitude: -73.9855,
  nickname: "New York city center",
  formattedAddress: "New York city center",
};

afterEach(() => {
  delete process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
});

describe("buildRideshareDeepLink — Uber /looking", () => {
  it("uses /looking with JSON-encoded pickup and drop[0]", () => {
    const url = buildRideshareDeepLink("uber", {
      pickup: jfkPickup,
      dropoff: nycDropoff,
    });
    const parsed = new URL(url);

    assert.equal(parsed.origin + parsed.pathname, "https://m.uber.com/looking");
    assert.equal(parsed.searchParams.has("client_id"), false);

    const pickup = JSON.parse(parsed.searchParams.get("pickup") ?? "null");
    assert.deepEqual(pickup, {
      latitude: 40.6413,
      longitude: -73.7781,
      addressLine1: "JFK",
      addressLine2: "John F. Kennedy International Airport",
    });

    const drop = JSON.parse(parsed.searchParams.get("drop[0]") ?? "null");
    assert.deepEqual(drop, {
      latitude: 40.758,
      longitude: -73.9855,
      addressLine1: "New York city center",
      addressLine2: "New York city center",
    });
  });

  it("omits drop[0] for pickup-only links", () => {
    const url = buildRideshareDeepLink("uber", jfkPickup, null);
    const parsed = new URL(url);

    assert.equal(parsed.origin + parsed.pathname, "https://m.uber.com/looking");
    assert.ok(parsed.searchParams.get("pickup"));
    assert.equal(parsed.searchParams.get("drop[0]"), null);
  });

  it("includes client_id when NEXT_PUBLIC_UBER_CLIENT_ID is set", () => {
    process.env.NEXT_PUBLIC_UBER_CLIENT_ID = " test-client-id ";
    const url = buildRideshareDeepLink("uber", {
      pickup: jfkPickup,
      dropoff: nycDropoff,
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("client_id"), "test-client-id");
  });

  it("keeps the pickup | options overload working", () => {
    const fromPickup = buildRideshareDeepLink("uber", jfkPickup, nycDropoff);
    const fromOptions = buildRideshareDeepLink("uber", {
      pickup: jfkPickup,
      dropoff: nycDropoff,
    });
    assert.equal(fromPickup, fromOptions);
  });
});

describe("buildRideshareDeepLink — Bolt", () => {
  it("does not use the dead /en/deeplink/ 404 path", () => {
    const url = buildRideshareDeepLink("bolt", {
      pickup: jfkPickup,
      dropoff: nycDropoff,
    });

    assert.match(url, /^https:\/\/bolt\.eu\//);
    assert.doesNotMatch(url, /\/en\/deeplink\//);
    assert.doesNotMatch(url, /client_request_ride/);
    // No invented prefill params — Bolt's public web entry no longer accepts them.
    assert.doesNotMatch(url, /pickup_latitude|destination_latitude/);
    assert.equal(url, "https://bolt.eu/en/rides/");
  });

  it("reports that Bolt links do not prefill the route", () => {
    assert.equal(rideshareDeepLinkPrefillsRoute("bolt"), false);
    assert.equal(rideshareDeepLinkPrefillsRoute("uber"), true);
  });
});
