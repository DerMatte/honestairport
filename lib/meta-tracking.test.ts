import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activationEventIdFromWhopId,
  createMetaEventId,
  getGa4MeasurementId,
  getMetaPixelId,
  getPublicGa4MeasurementId,
  getPublicMetaPixelId,
  isGa4BrowserEnabled,
  isGa4MeasurementProtocolEnabled,
  isMetaCapiEnabled,
  isMetaPixelEnabled,
} from "./meta-tracking";

describe("meta tracking env gates", () => {
  it("stays off when pixel / token env is empty or not a numeric Pixel id", () => {
    assert.equal(isMetaPixelEnabled({}), false);
    assert.equal(isMetaCapiEnabled({}), false);
    assert.equal(getPublicMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "not-a-pixel" }), null);
    assert.equal(getPublicMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "  " }), null);
    assert.equal(isMetaCapiEnabled({ META_CAPI_ACCESS_TOKEN: "token" }), false);
    assert.equal(isGa4BrowserEnabled({}), false);
    assert.equal(isGa4MeasurementProtocolEnabled({}), false);
    assert.equal(
      getPublicGa4MeasurementId({ NEXT_PUBLIC_GA4_MEASUREMENT_ID: "not-a-ga4" }),
      null,
    );
  });

  it("enables Pixel from the public id and CAPI when token + pixel are set", () => {
    const env = {
      NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
      META_CAPI_ACCESS_TOKEN: "EAAG_test",
    };
    assert.equal(isMetaPixelEnabled(env), true);
    assert.equal(isMetaCapiEnabled(env), true);
    assert.equal(getMetaPixelId({ META_PIXEL_ID: "999001122334455" }), "999001122334455");
    assert.equal(getMetaPixelId(env), "123456789012345");
  });

  it("enables GA4 gtag from the public Measurement ID and MP when secret is set", () => {
    const env = {
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-ABC123DEF4",
      GA4_API_SECRET: "ga4_secret",
    };
    assert.equal(isGa4BrowserEnabled(env), true);
    assert.equal(isGa4MeasurementProtocolEnabled(env), true);
    assert.equal(isGa4MeasurementProtocolEnabled({ NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-ABC123DEF4" }), false);
    assert.equal(getGa4MeasurementId({ GA4_MEASUREMENT_ID: "G-SERVER99" }), "G-SERVER99");
    assert.equal(getGa4MeasurementId(env), "G-ABC123DEF4");
  });

  it("keeps activation event_ids stable for the same Whop payment id", () => {
    assert.equal(activationEventIdFromWhopId("pay_abc"), "whop_pay_abc");
    assert.equal(activationEventIdFromWhopId(" pay_abc "), "whop_pay_abc");
    const a = createMetaEventId("ic");
    const b = createMetaEventId("ic");
    assert.match(a, /^ic_/);
    assert.notEqual(a, b);
  });
});
