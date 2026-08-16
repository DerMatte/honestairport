import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { FacilitatorClient } from "@x402/core/server";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_X402_FACILITATOR_URL,
  DEFAULT_X402_NETWORK,
  DEFAULT_X402_PRICE,
  createX402ResourceServer,
  getX402SellerConfig,
  handleMarkdownWithOptionalPayment,
  isPaidMarkdownPath,
  isPaidMarkdownSegments,
  isX402Enabled,
  paidMarkdownResourceUrl,
  paidMarkdownRouteConfig,
  resetX402ServerCache,
  type X402SellerConfig,
} from "./x402";

const TEST_PAY_TO = "0x0000000000000000000000000000000000000001";

const enabledEnv = {
  X402_PAY_TO: ` ${TEST_PAY_TO} `,
};

function testConfig(overrides: Partial<X402SellerConfig> = {}): X402SellerConfig {
  return {
    payTo: TEST_PAY_TO,
    network: DEFAULT_X402_NETWORK,
    facilitatorUrl: DEFAULT_X402_FACILITATOR_URL,
    price: DEFAULT_X402_PRICE,
    ...overrides,
  };
}

const TEST_ORIGIN = "http://x402.test";

function markdownRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, TEST_ORIGIN), {
    headers: { accept: "text/markdown" },
  });
}

function localFacilitator(network = DEFAULT_X402_NETWORK): FacilitatorClient {
  return {
    async verify() {
      return { isValid: false, invalidReason: "test-unpaid" };
    },
    async settle() {
      return { success: false, transaction: "", network };
    },
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network }],
        extensions: [],
        signers: {},
      };
    },
  };
}

afterEach(() => {
  resetX402ServerCache();
});

describe("isX402Enabled / getX402SellerConfig", () => {
  it("is off when X402_PAY_TO is missing or blank", () => {
    assert.equal(isX402Enabled({}), false);
    assert.equal(isX402Enabled({ X402_PAY_TO: "" }), false);
    assert.equal(isX402Enabled({ X402_PAY_TO: "   " }), false);
    assert.equal(getX402SellerConfig({}), null);
    assert.equal(getX402SellerConfig({ X402_PAY_TO: "\n" }), null);
  });

  it("reads pay-to and applies network / facilitator / price defaults", () => {
    assert.equal(isX402Enabled(enabledEnv), true);
    assert.deepEqual(getX402SellerConfig(enabledEnv), {
      payTo: TEST_PAY_TO,
      network: DEFAULT_X402_NETWORK,
      facilitatorUrl: DEFAULT_X402_FACILITATOR_URL,
      price: DEFAULT_X402_PRICE,
    });
  });

  it("lets network, facilitator, and price be overridden", () => {
    assert.deepEqual(
      getX402SellerConfig({
        X402_PAY_TO: TEST_PAY_TO,
        X402_NETWORK: "eip155:8453",
        X402_FACILITATOR_URL: "https://facilitator.example/x402",
        X402_PRICE: "$0.05",
      }),
      {
        payTo: TEST_PAY_TO,
        network: "eip155:8453",
        facilitatorUrl: "https://facilitator.example/x402",
        price: "$0.05",
      },
    );
  });
});

describe("paid markdown path helpers", () => {
  it("does not gate HTML airport or lounge pages", () => {
    assert.equal(isPaidMarkdownPath("/airports/lax"), false);
    assert.equal(isPaidMarkdownPath("/airports/lax/lounge/star-alliance"), false);
    assert.equal(isPaidMarkdownPath("/"), false);
  });

  it("does not gate free markdown discovery routes", () => {
    assert.equal(isPaidMarkdownPath("/index.md"), false);
    assert.equal(isPaidMarkdownPath("/sitemap.md"), false);
    assert.equal(isPaidMarkdownPath("/.md"), false);
    assert.equal(isPaidMarkdownPath("/llms.txt"), false);
    assert.equal(isPaidMarkdownPath("/md"), false);
    assert.equal(isPaidMarkdownPath("/md/sitemap"), false);
    assert.equal(isPaidMarkdownSegments([]), false);
    assert.equal(isPaidMarkdownSegments(["index"]), false);
    assert.equal(isPaidMarkdownSegments(["sitemap"]), false);
  });

  it("gates airport and lounge markdown (public and rewritten /md paths)", () => {
    assert.equal(isPaidMarkdownPath("/airports/lax.md"), true);
    assert.equal(isPaidMarkdownPath("/airports/LAX.md"), true);
    assert.equal(isPaidMarkdownPath("/md/airports/lax"), true);
    assert.equal(isPaidMarkdownPath("/airports/lax/lounge/star-alliance.md"), true);
    assert.equal(isPaidMarkdownPath("/md/airports/lax/lounge/star-alliance"), true);
    assert.equal(isPaidMarkdownSegments(["airports", "lax"]), true);
    assert.equal(
      isPaidMarkdownSegments(["airports", "lax", "lounge", "star-alliance"]),
      true,
    );
  });

  it("maps paid /md segments back to the public .md URL", () => {
    const request = markdownRequest("/md/airports/lax");
    assert.equal(
      paidMarkdownResourceUrl(request, ["airports", "lax"]),
      `${TEST_ORIGIN}/airports/lax.md`,
    );
    assert.equal(
      paidMarkdownResourceUrl(
        markdownRequest("/md/airports/lax/lounge/star"),
        ["airports", "lax", "lounge", "star"],
      ),
      `${TEST_ORIGIN}/airports/lax/lounge/star.md`,
    );
  });
});

describe("handleMarkdownWithOptionalPayment", () => {
  it("leaves the handler alone when X402_PAY_TO is unset", async () => {
    let served = 0;
    const response = await handleMarkdownWithOptionalPayment(
      markdownRequest("/md/airports/lax"),
      ["airports", "lax"],
      async () => {
        served += 1;
        return new NextResponse("# LAX\n", { status: 200 });
      },
      { env: {} },
    );

    assert.equal(served, 1);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "# LAX\n");
  });

  it("does not gate /index.md or /sitemap.md when the paywall is on", async () => {
    for (const [path, segments] of [
      ["/md", []],
      ["/md/index", ["index"]],
      ["/md/sitemap", ["sitemap"]],
    ] as const) {
      let served = 0;
      const response = await handleMarkdownWithOptionalPayment(
        markdownRequest(path),
        [...segments],
        async () => {
          served += 1;
          return new NextResponse("free\n", { status: 200 });
        },
        { env: enabledEnv },
      );
      assert.equal(served, 1, path);
      assert.equal(response.status, 200, path);
    }
  });

  it("returns 402 with payment instructions for airport .md when enabled", async () => {
    const config = testConfig();
    const server = createX402ResourceServer(config, localFacilitator());
    await server.initialize();

    let served = 0;
    const response = await handleMarkdownWithOptionalPayment(
      markdownRequest("/md/airports/lax"),
      ["airports", "lax"],
      async () => {
        served += 1;
        return new NextResponse("# should not run\n", { status: 200 });
      },
      {
        env: enabledEnv,
        server,
        syncFacilitatorOnStart: false,
      },
    );

    assert.equal(served, 0);
    assert.equal(response.status, 402);

    const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
    assert.ok(paymentRequired, "expected PAYMENT-REQUIRED header");

    const decoded = decodePaymentRequiredHeader(paymentRequired);
    assert.equal(decoded.x402Version, 2);
    assert.equal(decoded.resource.url, `${TEST_ORIGIN}/airports/lax.md`);
    assert.ok(decoded.accepts.length >= 1);

    const accept = decoded.accepts[0];
    assert.equal(accept.scheme, "exact");
    assert.equal(accept.network, DEFAULT_X402_NETWORK);
    assert.equal(accept.payTo, TEST_PAY_TO);
    assert.equal(accept.amount, "10000");
  });

  it("returns 402 for lounge markdown when enabled", async () => {
    const config = testConfig();
    const server = createX402ResourceServer(config, localFacilitator());
    await server.initialize();

    const response = await handleMarkdownWithOptionalPayment(
      markdownRequest("/md/airports/lax/lounge/star-alliance"),
      ["airports", "lax", "lounge", "star-alliance"],
      async () => new NextResponse("# lounge\n", { status: 200 }),
      { env: enabledEnv, server, syncFacilitatorOnStart: false },
    );

    assert.equal(response.status, 402);
    const decoded = decodePaymentRequiredHeader(
      response.headers.get("PAYMENT-REQUIRED") ?? "",
    );
    assert.equal(
      decoded.resource.url,
      `${TEST_ORIGIN}/airports/lax/lounge/star-alliance.md`,
    );
  });
});

describe("paidMarkdownRouteConfig", () => {
  it("advertises exact USDC on the configured network", () => {
    const route = paidMarkdownRouteConfig(testConfig({ price: "$0.05" }));
    const accepts = Array.isArray(route.accepts) ? route.accepts[0] : route.accepts;
    assert.equal(accepts.scheme, "exact");
    assert.equal(accepts.price, "$0.05");
    assert.equal(accepts.network, DEFAULT_X402_NETWORK);
    assert.equal(accepts.payTo, TEST_PAY_TO);
    assert.equal(route.mimeType, "text/markdown");
  });
});
