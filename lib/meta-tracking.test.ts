import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMetaEventId,
  getMetaPixelId,
  getPublicMetaPixelId,
  isMetaCapiEnabled,
  isMetaPixelEnabled,
  subscribeEventIdFromWhopId,
} from "./meta-tracking";

describe("meta tracking env gates", () => {
  it("stays off when pixel / token env is empty or not a numeric Pixel id", () => {
    assert.equal(isMetaPixelEnabled({}), false);
    assert.equal(isMetaCapiEnabled({}), false);
    assert.equal(getPublicMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "not-a-pixel" }), null);
    assert.equal(getPublicMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "  " }), null);
    assert.equal(isMetaCapiEnabled({ META_CAPI_ACCESS_TOKEN: "token" }), false);
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

  it("keeps Subscribe event_ids stable for the same Whop payment id", () => {
    assert.equal(subscribeEventIdFromWhopId("pay_abc"), "whop_pay_abc");
    assert.equal(subscribeEventIdFromWhopId(" pay_abc "), "whop_pay_abc");
    const a = createMetaEventId("ic");
    const b = createMetaEventId("ic");
    assert.match(a, /^ic_/);
    assert.notEqual(a, b);
  });
});
