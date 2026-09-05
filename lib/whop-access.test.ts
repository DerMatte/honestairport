import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWhopAccessConfigured,
  resolveWhopProfileImage,
  userHasLiveWhopMembership,
  whopProfilePictureUrl,
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

describe("whopProfilePictureUrl", () => {
  it("reads url, source_url, or a bare https string", () => {
    assert.equal(
      whopProfilePictureUrl({ url: "https://img.whop.com/a.jpg" }),
      "https://img.whop.com/a.jpg",
    );
    assert.equal(
      whopProfilePictureUrl({ source_url: "https://img.whop.com/b.jpg" }),
      "https://img.whop.com/b.jpg",
    );
    assert.equal(
      whopProfilePictureUrl("https://img.whop.com/c.jpg"),
      "https://img.whop.com/c.jpg",
    );
  });

  it("rejects missing, non-http, and empty values", () => {
    assert.equal(whopProfilePictureUrl(null), null);
    assert.equal(whopProfilePictureUrl({ url: "/relative.jpg" }), null);
    assert.equal(whopProfilePictureUrl({ url: "javascript:alert(1)" }), null);
    assert.equal(whopProfilePictureUrl({}), null);
  });
});

describe("resolveWhopProfileImage", () => {
  it("does not call Whop when the visitor is signed out or the gate is off", async () => {
    let called = 0;
    const retrieve = async () => {
      called += 1;
      return { profile_picture: { url: "https://img.whop.com/a.jpg" } };
    };
    assert.equal(
      await resolveWhopProfileImage({
        env: configuredEnv,
        signedIn: false,
        accountWhopUserId: "user_abc",
        retrieveUser: retrieve,
      }),
      null,
    );
    assert.equal(
      await resolveWhopProfileImage({
        env: {},
        signedIn: true,
        accountWhopUserId: "user_abc",
        retrieveUser: retrieve,
      }),
      null,
    );
    assert.equal(called, 0);
  });

  it("returns the Whop photo when retrieve succeeds", async () => {
    const url = await resolveWhopProfileImage({
      env: configuredEnv,
      signedIn: true,
      accountWhopUserId: "user_abc",
      retrieveUser: async (id) => {
        assert.equal(id, "user_abc");
        return { profile_picture: { url: "https://img.whop.com/me.jpg" } };
      },
    });
    assert.equal(url, "https://img.whop.com/me.jpg");
  });

  it("returns null when retrieve throws or the picture is missing", async () => {
    assert.equal(
      await resolveWhopProfileImage({
        env: configuredEnv,
        signedIn: true,
        accountWhopUserId: "user_abc",
        retrieveUser: async () => {
          throw new Error("whop down");
        },
      }),
      null,
    );
    assert.equal(
      await resolveWhopProfileImage({
        env: configuredEnv,
        signedIn: true,
        accountWhopUserId: "user_abc",
        retrieveUser: async () => ({ profile_picture: null }),
      }),
      null,
    );
  });
});
