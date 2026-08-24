import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWhopAccessConfigured,
  userHasLiveWhopMembership,
} from "./whop-access";

const configuredEnv = {
  WHOP_API_KEY: "whop_test_key",
  WHOP_PRODUCT_ID: "prod_existing",
};

describe("isWhopAccessConfigured", () => {
  it("requires both API key and product id", () => {
    assert.equal(isWhopAccessConfigured({}), false);
    assert.equal(isWhopAccessConfigured({ WHOP_API_KEY: "k" }), false);
    assert.equal(isWhopAccessConfigured({ WHOP_PRODUCT_ID: "prod_x" }), false);
    assert.equal(isWhopAccessConfigured(configuredEnv), true);
  });
});

describe("userHasLiveWhopMembership", () => {
  it("does not skip when Whop env is unset", async () => {
    let called = 0;
    const granted = await userHasLiveWhopMembership(
      { whopUserId: "user_abc" },
      {},
      async () => {
        called += 1;
        return true;
      },
    );
    assert.equal(granted, false);
    assert.equal(called, 0);
  });

  it("does not skip when the account has no stored whopUserId", async () => {
    let called = 0;
    const granted = await userHasLiveWhopMembership(
      { whopUserId: null },
      configuredEnv,
      async () => {
        called += 1;
        return true;
      },
    );
    assert.equal(granted, false);
    assert.equal(called, 0);
  });

  it("skips when checkAccess reports a live product membership", async () => {
    const granted = await userHasLiveWhopMembership(
      { whopUserId: "user_abc" },
      configuredEnv,
      async (id) => {
        assert.equal(id, "user_abc");
        return true;
      },
    );
    assert.equal(granted, true);
  });

  it("does not skip when checkAccess says the user lacks the product", async () => {
    const granted = await userHasLiveWhopMembership(
      { whopUserId: "user_abc" },
      configuredEnv,
      async () => false,
    );
    assert.equal(granted, false);
  });

  it("fails closed when checkAccess throws", async () => {
    const granted = await userHasLiveWhopMembership(
      { whopUserId: "user_abc" },
      configuredEnv,
      async () => {
        throw new Error("whop down");
      },
    );
    assert.equal(granted, false);
  });
});
