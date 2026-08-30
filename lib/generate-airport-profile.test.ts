import assert from "node:assert/strict";
import test from "node:test";
import type { AirportRecord } from "./airports";
import { profileInputFromScore } from "./generate-airport-profile";
import type { AirportScoreProfile } from "./airport-profile-schema";

const record: AirportRecord = {
  id: "test-lax",
  name: "Los Angeles International Airport",
  city_name: "Los Angeles",
  city: "Los Angeles",
  iata_city_code: "LAX",
  iata_country_code: "US",
  icao_code: "KLAX",
  iata_code: "LAX",
  latitude: 33.94,
  longitude: -118.41,
  time_zone: "America/Los_Angeles",
};

const score: AirportScoreProfile = {
  shortName: "Los Angeles LAX",
  region: "Europe",
  summary: "Huge, useful, and tiring.",
  airportistScore: 6.4,
  scoreBreakdown: {
    comfort: 6,
    navigation: 6.5,
    food: 7,
    transport: 7.5,
    disruptionResilience: 5.5,
  },
  stats: {
    annualPassengers: "75M+",
    terminals: "9",
    onTimePercentage: 72,
    averageSecurityMinutes: 25,
  },
  bestFor: ["connections", "food"],
  watchOutFor: ["walks", "delays"],
  amenities: [
    {
      label: "Terminal food",
      category: "food",
      description: "Better than it used to be in TBIT.",
      quality: "good",
    },
  ],
  tips: [
    {
      category: "security",
      title: "Check the app",
      summary: "Wait times vary by terminal.",
      details: "Use the official LAX app before you leave.",
    },
  ],
  transport: [
    {
      type: "bus",
      name: "FlyAway",
      summary: "Airport bus to Union Station.",
      timeToCity: "45-70 min",
      cost: "$10",
      insiderTip: "Buy the ticket before you land.",
      bestFor: ["cheapest"],
    },
  ],
  disruption: {
    status: "minor",
    departureDelayMinutes: 18,
    departureDelayPercent: 22,
    arrivalDelayMinutes: 16,
    arrivalDelayPercent: 20,
    cancellationsPercent: 1.8,
    alerts: ["Evening marine layer"],
  },
};

test("profileInputFromScore uses reference geo and country region", () => {
  const input = profileInputFromScore("lax", record, score);

  assert.equal(input.icao, "KLAX");
  assert.equal(input.latitude, 33.94);
  assert.equal(input.longitude, -118.41);
  assert.equal(input.region, "North America");
  assert.equal(input.shortName, "Los Angeles LAX");
  assert.equal(input.airportistScore, 6.4);
  assert.equal(input.amenities[0].id, "lax-amenity-1");
  assert.equal(input.tips[0].id, "lax-tip-1");
  assert.deepEqual(input.disruption.alerts, ["Evening marine layer"]);
  assert.ok(typeof input.disruption.lastUpdated === "string");
});
