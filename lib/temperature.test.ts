import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { celsiusToFahrenheit } from "./temperature";

describe("celsiusToFahrenheit", () => {
  it("rounds 31°C to 88°F", () => {
    assert.equal(celsiusToFahrenheit(31), 88);
  });

  it("converts freezing and boiling", () => {
    assert.equal(celsiusToFahrenheit(0), 32);
    assert.equal(celsiusToFahrenheit(100), 212);
  });
});
