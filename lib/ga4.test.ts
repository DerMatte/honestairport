import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGa4ActivationEvents,
  sendGa4MeasurementProtocol,
} from "./ga4";
import { MEMBER_CONTENT_NAME, MEMBER_SUBSCRIBE_VALUE } from "./meta-tracking";

const ga4Env = {
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-ABC123DEF4",
  GA4_API_SECRET: "ga4_test_secret",
};

describe("buildGa4ActivationEvents", () => {
  it("emits purchase + subscribe with the shared transaction_id and $8 USD", () => {
    const payload = buildGa4ActivationEvents({
      eventId: "whop_pay_abc123",
      userId: "user_whop1",
      eventTimeSec: 1_700_000_000,
    });
    assert.equal(payload.client_id, "ha.user_whop1");
    assert.equal(payload.user_id, "user_whop1");
    assert.equal(payload.timestamp_micros, 1_700_000_000_000_000);
    assert.deepEqual(
      payload.events.map((event) => event.name),
      ["purchase", "subscribe"],
    );
    for (const event of payload.events) {
      assert.equal(event.params.transaction_id, "whop_pay_abc123");
      assert.equal(event.params.value, MEMBER_SUBSCRIBE_VALUE);
      assert.equal(event.params.currency, "USD");
      assert.equal(event.params.item_name, MEMBER_CONTENT_NAME);
      assert.equal(event.params.items?.[0]?.item_name, MEMBER_CONTENT_NAME);
    }
  });
});

describe("sendGa4MeasurementProtocol", () => {
  it("no-ops without measurement id / API secret and never fetches", async () => {
    let called = 0;
    const result = await sendGa4MeasurementProtocol(
      buildGa4ActivationEvents({ eventId: "whop_pay_x" }),
      {
        env: {},
        fetchImpl: async () => {
          called += 1;
          throw new Error("should not fetch");
        },
      },
    );
    assert.deepEqual(result, { ok: true, skipped: "ga4_off" });
    assert.equal(called, 0);
  });

  it("POSTs purchase + subscribe to mp/collect when env is set", async () => {
    const payload = buildGa4ActivationEvents({
      eventId: "whop_pay_live",
      userId: "user_1",
    });
    let url = "";
    let rawBody = "";
    const result = await sendGa4MeasurementProtocol(payload, {
      env: ga4Env,
      fetchImpl: async (input, init) => {
        url = String(input);
        rawBody = String(init?.body);
        return new Response(null, { status: 204 });
      },
    });
    assert.deepEqual(result, { ok: true, status: 204 });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://www.google-analytics.com/mp/collect");
    assert.equal(parsed.searchParams.get("measurement_id"), "G-ABC123DEF4");
    assert.equal(parsed.searchParams.get("api_secret"), "ga4_test_secret");
    const body = JSON.parse(rawBody) as typeof payload;
    assert.deepEqual(
      body.events.map((event) => event.name),
      ["purchase", "subscribe"],
    );
    assert.equal(body.events[0]?.params.transaction_id, "whop_pay_live");
  });
});
