import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_WHOP_PRODUCT_ID } from "./whop-gate";
import {
  handleWhopWebhook,
  signWhopWebhook,
  subscribeEventIdForWebhook,
  verifyWhopWebhookSignature,
} from "./whop-webhook";

const nowSec = 1_700_000_100;
const webhookId = "msg_test_webhook_1";
const whsec = `whsec_${Buffer.from("standard-webhooks-test-key-32b!!").toString("base64")}`;
const wsSecret = "ws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const paymentBody = JSON.stringify({
  id: webhookId,
  type: "payment.succeeded",
  timestamp: "2023-11-14T22:15:00.000Z",
  data: {
    id: "pay_abc123",
    product: { id: DEFAULT_WHOP_PRODUCT_ID },
    plan: { id: "plan_ee0kSfuyD6v9a" },
    user: { id: "user_whop1", email: "member@example.com" },
  },
});

function signedHeaders(secret: string, body: string, timestamp = nowSec) {
  return {
    "webhook-id": webhookId,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signWhopWebhook(secret, webhookId, timestamp, body),
    "content-type": "application/json",
  };
}

describe("verifyWhopWebhookSignature", () => {
  it("accepts a Standard Webhooks (whsec_) signature", () => {
    const result = verifyWhopWebhookSignature({
      rawBody: paymentBody,
      headers: signedHeaders(whsec, paymentBody),
      secret: whsec,
      nowSec,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.event.type, "payment.succeeded");
      assert.equal(result.event.data?.id, "pay_abc123");
    }
  });

  it("accepts a current Whop ws_ secret signed as UTF-8 HMAC", () => {
    const result = verifyWhopWebhookSignature({
      rawBody: paymentBody,
      headers: signedHeaders(wsSecret, paymentBody),
      secret: wsSecret,
      nowSec,
    });
    assert.equal(result.ok, true);
  });

  it("rejects a tampered body, missing headers, wrong secret, and stale timestamp", () => {
    const good = signedHeaders(whsec, paymentBody);
    assert.equal(
      verifyWhopWebhookSignature({
        rawBody: paymentBody.replace("pay_abc123", "pay_evil"),
        headers: good,
        secret: whsec,
        nowSec,
      }).ok,
      false,
    );
    assert.equal(
      verifyWhopWebhookSignature({
        rawBody: paymentBody,
        headers: { "content-type": "application/json" },
        secret: whsec,
        nowSec,
      }).ok,
      false,
    );
    assert.equal(
      verifyWhopWebhookSignature({
        rawBody: paymentBody,
        headers: good,
        secret: `whsec_${Buffer.from("other-key-that-is-not-the-same!!").toString("base64")}`,
        nowSec,
      }).ok,
      false,
    );
    assert.equal(
      verifyWhopWebhookSignature({
        rawBody: paymentBody,
        headers: signedHeaders(whsec, paymentBody, nowSec - 400),
        secret: whsec,
        nowSec,
      }).ok,
      false,
    );
  });
});

describe("handleWhopWebhook Subscribe mapping", () => {
  const env = {
    WHOP_WEBHOOK_SECRET: whsec,
    NEXT_PUBLIC_SITE_URL: "https://www.honestairport.com",
    META_PIXEL_ID: "123456789012345",
    META_CAPI_ACCESS_TOKEN: "EAAG_test",
  };

  it("is inert (404) when WHOP_WEBHOOK_SECRET is unset", () => {
    const result = handleWhopWebhook({
      rawBody: paymentBody,
      headers: signedHeaders(whsec, paymentBody),
      env: {},
      nowSec,
    });
    assert.equal(result.status, 404);
    assert.equal(result.subscribe, null);
    if ("error" in result.body) {
      assert.equal(result.body.error, "webhook_off");
    }
  });

  it("rejects a bad signature with 401 and does not build Subscribe", () => {
    const result = handleWhopWebhook({
      rawBody: paymentBody,
      headers: {
        ...signedHeaders(whsec, paymentBody),
        "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      env,
      nowSec,
    });
    assert.equal(result.status, 401);
    assert.equal(result.subscribe, null);
  });

  it("builds a stable Subscribe payload for payment.succeeded on the Members product", () => {
    const first = handleWhopWebhook({
      rawBody: paymentBody,
      headers: signedHeaders(whsec, paymentBody),
      env,
      nowSec,
    });
    const retry = handleWhopWebhook({
      rawBody: paymentBody,
      headers: signedHeaders(whsec, paymentBody),
      env,
      nowSec,
    });
    assert.equal(first.status, 200);
    assert.ok(first.subscribe);
    assert.ok(first.purchase);
    assert.equal(first.subscribe.event_name, "Subscribe");
    assert.equal(first.purchase.event_name, "Purchase");
    assert.equal(first.subscribe.event_id, "whop_pay_abc123");
    assert.equal(first.purchase.event_id, first.subscribe.event_id);
    assert.equal(first.capiEvents.length, 2);
    assert.equal(first.subscribe.custom_data?.value, 8);
    assert.equal(first.subscribe.custom_data?.currency, "USD");
    assert.equal(first.subscribe.custom_data?.content_name, "HonestAirport Members");
    assert.deepEqual(first.purchase.custom_data, first.subscribe.custom_data);
    assert.equal(first.subscribe.event_source_url, "https://www.honestairport.com/members");
    assert.equal(first.subscribe.action_source, "website");
    assert.equal(retry.subscribe?.event_id, first.subscribe.event_id);
    assert.equal(retry.purchase?.event_id, first.subscribe.event_id);
    assert.ok(first.ga4);
    assert.deepEqual(
      first.ga4.events.map((event) => event.name),
      ["purchase", "subscribe"],
    );
    assert.equal(first.ga4.events[0]?.params.transaction_id, "whop_pay_abc123");
    assert.equal(first.ga4.events[1]?.params.transaction_id, "whop_pay_abc123");
    assert.equal(first.ga4.events[0]?.params.value, 8);
    assert.equal(first.ga4.user_id, "user_whop1");
    assert.equal(
      subscribeEventIdForWebhook({ type: "payment.succeeded", data: { id: "pay_abc123" } }),
      "whop_pay_abc123",
    );
  });

  it("uses the membership id for membership.activated retries", () => {
    const body = JSON.stringify({
      id: webhookId,
      type: "membership.activated",
      timestamp: "2023-11-14T22:15:00.000Z",
      data: {
        id: "mem_xyz",
        product: { id: DEFAULT_WHOP_PRODUCT_ID },
        plan: { id: "plan_ee0kSfuyD6v9a" },
        user: { id: "user_whop1" },
      },
    });
    const result = handleWhopWebhook({
      rawBody: body,
      headers: signedHeaders(whsec, body),
      env,
      nowSec,
    });
    assert.equal(result.status, 200);
    assert.equal(result.subscribe?.event_id, "whop_mem_xyz");
    assert.equal(result.purchase?.event_id, "whop_mem_xyz");
    assert.equal(result.subscribe?.event_name, "Subscribe");
    assert.equal(result.purchase?.event_name, "Purchase");
  });

  it("acknowledges unmatched products and ignored event types without CAPI", () => {
    const other = JSON.stringify({
      id: webhookId,
      type: "payment.succeeded",
      data: { id: "pay_other", product: { id: "prod_OTHER" }, plan: { id: "plan_OTHER" } },
    });
    const skippedProduct = handleWhopWebhook({
      rawBody: other,
      headers: signedHeaders(whsec, other),
      env,
      nowSec,
    });
    assert.equal(skippedProduct.status, 200);
    assert.equal(skippedProduct.subscribe, null);
    if ("ok" in skippedProduct.body) {
      assert.equal(skippedProduct.body.skipped, "not_members");
    }

    const refund = JSON.stringify({
      id: webhookId,
      type: "refund.created",
      data: { id: "ref_1", product: { id: DEFAULT_WHOP_PRODUCT_ID } },
    });
    const skippedType = handleWhopWebhook({
      rawBody: refund,
      headers: signedHeaders(whsec, refund),
      env,
      nowSec,
    });
    assert.equal(skippedType.status, 200);
    assert.equal(skippedType.subscribe, null);
    if ("ok" in skippedType.body) {
      assert.equal(skippedType.body.skipped, "ignored_type");
    }
  });
});
