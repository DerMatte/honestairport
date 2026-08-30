import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNearbyAirports, isPassengerAirportName } from "./airports";

describe("isPassengerAirportName", () => {
  it("drops military and heliport names", () => {
    assert.equal(isPassengerAirportName("Paya Lebar Air Base"), false);
    assert.equal(isPassengerAirportName("Tengah Air Base"), false);
    assert.equal(isPassengerAirportName("RAF Lakenheath"), false);
    assert.equal(isPassengerAirportName("Ramstein AB Air Force Base"), false);
    assert.equal(isPassengerAirportName("Downtown Heliport"), false);
    assert.equal(isPassengerAirportName("Fort Hood Army Airfield"), false);
  });

  it("keeps passenger airports", () => {
    assert.equal(isPassengerAirportName("Singapore Changi Airport"), true);
    assert.equal(isPassengerAirportName("Senai International Airport"), true);
    assert.equal(
      isPassengerAirportName("Hang Nadim International Airport"),
      true,
    );
    assert.equal(isPassengerAirportName("Seletar Airport"), true);
  });
});

describe("getNearbyAirports", () => {
  it("lists passenger neighbors for SIN and omits air bases", () => {
    const nearby = getNearbyAirports("SIN");
    const iatas = nearby.map((airport) => airport.iata);

    assert.ok(!iatas.includes("QPG"), `QPG in ${iatas.join(",")}`);
    assert.ok(!iatas.includes("TGA"), `TGA in ${iatas.join(",")}`);
    assert.ok(
      iatas.includes("JHB") || iatas.includes("BTH"),
      `expected JHB or BTH in ${iatas.join(",")}`,
    );
    assert.equal(
      nearby.some((airport) => /air base/i.test(airport.name)),
      false,
    );
  });
});
