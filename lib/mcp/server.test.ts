import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { FacilitatorClient } from "@x402/core/server";
import { NextRequest } from "next/server";
import {
  createX402ResourceServer,
  DEFAULT_X402_NETWORK,
  resetX402ServerCache,
  type X402SellerConfig,
} from "@/lib/x402";
import { authenticateMcpToken, generateMcpToken, type McpTokenUser } from "./tokens";
import { handleMcpRequest } from "./server";

const USER: McpTokenUser = {
  id: "user-1",
  email: "traveler@example.com",
  name: "Traveler",
};

const MEMBER: McpTokenUser = {
  ...USER,
  id: "user-member",
  whopUserId: "user_whop_1",
};

const TEST_PAY_TO = "0x0000000000000000000000000000000000000001";
const PAY_TO_ENV = { X402_PAY_TO: TEST_PAY_TO };
const WHOP_ENV = {
  ...PAY_TO_ENV,
  WHOP_API_KEY: "whop_test_key",
  WHOP_PRODUCT_ID: "prod_existing",
};

function localFacilitator(): FacilitatorClient {
  return {
    async verify() {
      return { isValid: false, invalidReason: "test-unpaid" };
    },
    async settle() {
      return { success: false, transaction: "", network: DEFAULT_X402_NETWORK };
    },
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: DEFAULT_X402_NETWORK }],
        extensions: [],
        signers: {},
      };
    },
  };
}

function testSellerConfig(): X402SellerConfig {
  return {
    payTo: TEST_PAY_TO,
    network: DEFAULT_X402_NETWORK,
    facilitatorUrl: "https://x402.org/facilitator",
    price: "$0.01",
  };
}

function mcpRequest(
  headers: Record<string, string> = {},
  body: unknown = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "honestairport-tests", version: "0" },
    },
  },
): NextRequest {
  return new NextRequest("https://www.honestairport.com/mcp", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function toolCall(name: string, args: Record<string, unknown>): unknown {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

afterEach(() => {
  resetX402ServerCache();
});

describe("handleMcpRequest auth", () => {
  const token = generateMcpToken();
  const lookup = async (raw: string | null | undefined) =>
    authenticateMcpToken(raw, (hash) => (hash === token.hash ? USER : null));

  it("returns 401 without a token", async () => {
    const response = await handleMcpRequest(mcpRequest(), { lookup, env: {} });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  });

  it("returns 401 for get_lounge without a token even when pay-to is set", async () => {
    const response = await handleMcpRequest(
      mcpRequest({}, toolCall("get_lounge", { iata: "LAX", slug: "star-alliance" })),
      { lookup, env: PAY_TO_ENV },
    );
    assert.equal(response.status, 401);
  });

  it("returns 401 with a garbage token", async () => {
    const response = await handleMcpRequest(
      mcpRequest({ authorization: "Bearer nope-not-a-real-token" }),
      { lookup, env: {} },
    );
    assert.equal(response.status, 401);
  });

  it("accepts a valid account token (does not 401)", async () => {
    const response = await handleMcpRequest(
      mcpRequest({ authorization: `Bearer ${token.raw}` }),
      { lookup, env: {} },
    );
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });
});

describe("handleMcpRequest x402 scope", () => {
  const token = generateMcpToken();
  const lookup = async (raw: string | null | undefined) =>
    authenticateMcpToken(raw, (hash) => (hash === token.hash ? USER : null));

  async function paidLoungeOptions(overrides: Record<string, unknown> = {}) {
    const server = createX402ResourceServer(testSellerConfig(), localFacilitator());
    await server.initialize();
    return {
      lookup,
      env: PAY_TO_ENV,
      server,
      syncFacilitatorOnStart: false,
      loadPaidToolMarkdown: async () => "# lounge\n",
      ...overrides,
    };
  }

  it("never 402s get_airport when pay-to is set", async () => {
    const response = await handleMcpRequest(
      mcpRequest(
        { authorization: `Bearer ${token.raw}` },
        toolCall("get_airport", { iata: "LAX" }),
      ),
      await paidLoungeOptions(),
    );
    assert.notEqual(response.status, 402);
    assert.equal(response.headers.get("PAYMENT-REQUIRED"), null);
  });

  it("never 402s list_lounges when pay-to is set", async () => {
    const response = await handleMcpRequest(
      mcpRequest(
        { authorization: `Bearer ${token.raw}` },
        toolCall("list_lounges", { iata: "LAX" }),
      ),
      await paidLoungeOptions(),
    );
    assert.notEqual(response.status, 402);
    assert.equal(response.headers.get("PAYMENT-REQUIRED"), null);
  });

  it("402s get_lounge without a membership when pay-to is set", async () => {
    const response = await handleMcpRequest(
      mcpRequest(
        { authorization: `Bearer ${token.raw}` },
        toolCall("get_lounge", { iata: "LAX", slug: "star-alliance" }),
      ),
      await paidLoungeOptions(),
    );
    assert.equal(response.status, 402);
    assert.ok(response.headers.get("PAYMENT-REQUIRED"));
  });

  it("skips the lounge charge when the account has a live Whop membership", async () => {
    const memberToken = generateMcpToken();
    const memberLookup = async (raw: string | null | undefined) =>
      authenticateMcpToken(raw, (hash) =>
        hash === memberToken.hash ? MEMBER : null,
      );
    let checked = 0;
    const response = await handleMcpRequest(
      mcpRequest(
        { authorization: `Bearer ${memberToken.raw}` },
        toolCall("get_lounge", { iata: "LAX", slug: "star-alliance" }),
      ),
      await paidLoungeOptions({
        lookup: memberLookup,
        env: WHOP_ENV,
        checkWhopAccess: async (id: string) => {
          checked += 1;
          assert.equal(id, "user_whop_1");
          return true;
        },
      }),
    );
    assert.equal(checked, 1);
    assert.notEqual(response.status, 402);
    assert.equal(response.headers.get("PAYMENT-REQUIRED"), null);
  });

  it("still 402s get_lounge when Whop env is unset even if whopUserId is stored", async () => {
    const memberToken = generateMcpToken();
    const memberLookup = async (raw: string | null | undefined) =>
      authenticateMcpToken(raw, (hash) =>
        hash === memberToken.hash ? MEMBER : null,
      );
    let checked = 0;
    const response = await handleMcpRequest(
      mcpRequest(
        { authorization: `Bearer ${memberToken.raw}` },
        toolCall("get_lounge", { iata: "LAX", slug: "star-alliance" }),
      ),
      await paidLoungeOptions({
        lookup: memberLookup,
        env: PAY_TO_ENV,
        checkWhopAccess: async () => {
          checked += 1;
          return true;
        },
      }),
    );
    assert.equal(checked, 0);
    assert.equal(response.status, 402);
  });
});
