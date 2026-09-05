import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSubscribeCapiEvent,
  hashMetaPii,
  sendMetaCapiEvents,
  userDataFromRequest,
} from "./meta-capi";
import {
  MEMBER_CONTENT_NAME,
  MEMBER_SUBSCRIBE_CURRENCY,
  MEMBER_SUBSCRIBE_EVENT,
  MEMBER_SUBSCRIBE_VALUE,
  META_GRAPH_VERSION,
  subscribeEventIdFromWhopId,
} from "./meta-tracking";

const capiEnv = {
  NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
  META_CAPI_ACCESS_TOKEN: "EAAG_test_token",
  META_CAPI_TEST_EVENT_CODE: "TEST12345",
  NEXT_PUBLIC_SITE_URL: "https://www.honestairport.com",
};

describe("hashMetaPii", () => {
  it("trims, lowercases, and SHA-256 hashes email", () => {
    assert.equal(
      hashMetaPii("  Test@Example.COM "),
      hashMetaPii("test@example.com"),
    );
    assert.equal(hashMetaPii("test@example.com").length, 64);
  });
});

describe("subscribe payload shape", () => {
  it("builds a Subscribe event with $8 USD Members custom_data and stable event_id", () => {
    const eventId = subscribeEventIdFromWhopId("pay_abc123");
    assert.equal(eventId, "whop_pay_abc123");
    assert.equal(subscribeEventIdFromWhopId("pay_abc123"), eventId);

    const event = buildSubscribeCapiEvent({
      eventId,
      eventTime: 1_700_000_000,
      userData: userDataFromRequest({
        email: "Member@HonestAirport.com",
        externalId: "user_whop1",
      }),
      env: capiEnv,
    });

    assert.equal(event.event_name, MEMBER_SUBSCRIBE_EVENT);
    assert.equal(event.event_name, "Subscribe");
    assert.equal(event.event_id, "whop_pay_abc123");
    assert.equal(event.event_time, 1_700_000_000);
    assert.equal(event.action_source, "website");
    assert.equal(event.event_source_url, "https://www.honestairport.com/members");
    assert.deepEqual(event.custom_data, {
      value: MEMBER_SUBSCRIBE_VALUE,
      currency: MEMBER_SUBSCRIBE_CURRENCY,
      content_name: MEMBER_CONTENT_NAME,
    });
    assert.deepEqual(event.user_data.em, [hashMetaPii("member@honestairport.com")]);
    assert.equal(event.user_data.external_id, "user_whop1");
    assert.equal(event.user_data.client_ip_address, undefined);
  });

  it("copies fbp/fbc and client IP/UA from request headers when present", () => {
    const headers = new Headers({
      cookie: "_fbp=fb.1.1.2; _fbc=fb.1.1.IwAR0",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      "user-agent": "TestUA/1.0",
    });
    const userData = userDataFromRequest({}, headers);
    assert.equal(userData.fbp, "fb.1.1.2");
    assert.equal(userData.fbc, "fb.1.1.IwAR0");
    assert.equal(userData.client_ip_address, "203.0.113.9");
    assert.equal(userData.client_user_agent, "TestUA/1.0");
  });
});

describe("sendMetaCapiEvents", () => {
  it("no-ops without pixel/token and never fetches", async () => {
    let called = 0;
    const result = await sendMetaCapiEvents(
      [
        buildSubscribeCapiEvent({
          eventId: "whop_pay_x",
          env: {},
        }),
      ],
      {
        env: {},
        fetchImpl: async () => {
          called += 1;
          throw new Error("should not fetch");
        },
      },
    );
    assert.deepEqual(result, { ok: true, skipped: "capi_off" });
    assert.equal(called, 0);
  });

  it("POSTs to Graph with access_token in the body when env is set", async () => {
    const event = buildSubscribeCapiEvent({
      eventId: "whop_pay_live",
      eventTime: 1_700_000_001,
      env: capiEnv,
    });
    let url = "";
    let payload: Record<string, unknown> = {};
    const result = await sendMetaCapiEvents([event], {
      env: capiEnv,
      fetchImpl: async (input, init) => {
        url = String(input);
        payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
      },
    });
    assert.deepEqual(result, { ok: true, status: 200 });
    assert.equal(
      url,
      `https://graph.facebook.com/${META_GRAPH_VERSION}/123456789012345/events`,
    );
    assert.equal(payload.access_token, "EAAG_test_token");
    assert.equal(payload.test_event_code, "TEST12345");
    const data = payload.data as typeof event[];
    assert.equal(data[0]?.event_name, "Subscribe");
    assert.equal(data[0]?.event_id, "whop_pay_live");
    assert.equal(data[0]?.custom_data?.value, 8);
    assert.equal(data[0]?.custom_data?.currency, "USD");
    assert.equal(data[0]?.custom_data?.content_name, "HonestAirport Members");
  });
});
