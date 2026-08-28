import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getWhop,
  isWhopSandbox,
  resetWhopClient,
  resolveWhopBaseURL,
  WHOP_SANDBOX_API_BASE_URL,
} from "./whop";

const API_KEY = "apik_test_sandbox";

afterEach(() => {
  resetWhopClient();
});

describe("isWhopSandbox", () => {
  it("is off when unset, blank, or a non-truthy value", () => {
    assert.equal(isWhopSandbox({}), false);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "" }), false);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "  " }), false);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "0" }), false);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "false" }), false);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "no" }), false);
  });

  it("is on for 1, true, and yes (trimmed, case-insensitive)", () => {
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "1" }), true);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "true" }), true);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "yes" }), true);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: " TRUE " }), true);
    assert.equal(isWhopSandbox({ WHOP_SANDBOX: "Yes" }), true);
  });
});

describe("resolveWhopBaseURL", () => {
  it("omits baseURL in production when WHOP_SANDBOX is unset or false", () => {
    assert.equal(resolveWhopBaseURL({}), undefined);
    assert.equal(resolveWhopBaseURL({ WHOP_SANDBOX: "false" }), undefined);
    assert.equal(
      resolveWhopBaseURL({
        WHOP_SANDBOX: "0",
        WHOP_API_BASE_URL: "https://example.test/api/v1",
      }),
      undefined,
    );
  });

  it("uses the sandbox host when WHOP_SANDBOX is on", () => {
    assert.equal(
      resolveWhopBaseURL({ WHOP_SANDBOX: "1" }),
      WHOP_SANDBOX_API_BASE_URL,
    );
    assert.equal(WHOP_SANDBOX_API_BASE_URL, "https://sandbox-api.whop.com/api/v1");
  });

  it("lets WHOP_API_BASE_URL override the sandbox host", () => {
    assert.equal(
      resolveWhopBaseURL({
        WHOP_SANDBOX: "true",
        WHOP_API_BASE_URL: " https://custom-sandbox.example/api/v1 ",
      }),
      "https://custom-sandbox.example/api/v1",
    );
  });
});

describe("getWhop", () => {
  it("constructs a production client with no sandbox baseURL", () => {
    const client = getWhop({ WHOP_API_KEY: API_KEY });
    assert.equal(client.baseURL, "https://api.whop.com/api/v1");
  });

  it("constructs a sandbox client when WHOP_SANDBOX is on", () => {
    const client = getWhop({ WHOP_API_KEY: API_KEY, WHOP_SANDBOX: "1" });
    assert.equal(client.baseURL, WHOP_SANDBOX_API_BASE_URL);
  });

  it("constructs a client with WHOP_API_BASE_URL when sandbox is on", () => {
    const client = getWhop({
      WHOP_API_KEY: API_KEY,
      WHOP_SANDBOX: "yes",
      WHOP_API_BASE_URL: "https://override.example/api/v1",
    });
    assert.equal(client.baseURL, "https://override.example/api/v1");
  });

  it("does not reuse a production client after flipping WHOP_SANDBOX on", () => {
    const prod = getWhop({ WHOP_API_KEY: API_KEY });
    const sandbox = getWhop({ WHOP_API_KEY: API_KEY, WHOP_SANDBOX: "1" });
    assert.notEqual(prod, sandbox);
    assert.equal(prod.baseURL, "https://api.whop.com/api/v1");
    assert.equal(sandbox.baseURL, WHOP_SANDBOX_API_BASE_URL);
  });

  it("reuses the cached client when key and sandbox host match", () => {
    const first = getWhop({ WHOP_API_KEY: API_KEY, WHOP_SANDBOX: "1" });
    const second = getWhop({ WHOP_API_KEY: API_KEY, WHOP_SANDBOX: "true" });
    assert.equal(first, second);
  });
});
