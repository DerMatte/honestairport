/**
 * Env-gated x402 paywall for machine-readable airport/lounge markdown.
 *
 * Humans on HTML stay free. Home / sitemap / llms.txt stay free. The paywall
 * is off unless `X402_PAY_TO` is set, so production cannot surprise-charge.
 *
 * Settlement uses `withX402` (status < 400 only), so 404s never charge.
 */
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type RouteConfig,
} from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import { publicMarkdownPath } from "@/lib/markdown-negotiate";

export const X402_PAY_TO_ENV = "X402_PAY_TO";
export const X402_NETWORK_ENV = "X402_NETWORK";
export const X402_FACILITATOR_URL_ENV = "X402_FACILITATOR_URL";
export const X402_PRICE_ENV = "X402_PRICE";

/** Base Sepolia — first slice. Override with `X402_NETWORK=eip155:8453` for mainnet. */
export const DEFAULT_X402_NETWORK = "eip155:84532" satisfies Network;
/** Public testnet facilitator. Override for a production facilitator on mainnet. */
export const DEFAULT_X402_FACILITATOR_URL = "https://x402.org/facilitator";
export const DEFAULT_X402_PRICE = "$0.01";

export type X402Env = NodeJS.Dict<string>;

export type X402SellerConfig = {
  payTo: string;
  network: Network;
  facilitatorUrl: string;
  price: string;
};

function asNetwork(value: string): Network {
  if (!value.includes(":")) {
    throw new Error(`Invalid x402 network "${value}" (expected CAIP-2, e.g. eip155:84532)`);
  }
  return value as Network;
}

const AIRPORT_PUBLIC_MD = /^\/airports\/([^/]+)\.md$/;
const LOUNGE_PUBLIC_MD = /^\/airports\/([^/]+)\/lounge\/([^/]+)\.md$/;
const AIRPORT_INTERNAL_MD = /^\/md\/airports\/([^/]+)$/;
const LOUNGE_INTERNAL_MD = /^\/md\/airports\/([^/]+)\/lounge\/([^/]+)$/;

type CachedServer = {
  key: string;
  server: x402ResourceServer;
};

let cachedServer: CachedServer | null = null;

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
}

function readTrimmed(env: X402Env, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

/** Public receive address. Empty / missing means the paywall is off. */
export function readX402PayTo(env: X402Env = process.env): string | null {
  return readTrimmed(env, "X402_PAY_TO");
}

export function isX402Enabled(env: X402Env = process.env): boolean {
  return readX402PayTo(env) !== null;
}

/**
 * Paid machine-API paths only: airport/lounge markdown (public `.md` or
 * internal `/md/...` after `proxy.ts` rewrite). HTML pages, `/`, `/index.md`,
 * `/sitemap.md`, and `/llms.txt` are never paid.
 */
export function isPaidMarkdownPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (
    AIRPORT_PUBLIC_MD.test(path) ||
    LOUNGE_PUBLIC_MD.test(path) ||
    AIRPORT_INTERNAL_MD.test(path) ||
    LOUNGE_INTERNAL_MD.test(path)
  );
}

/** Catch-all `/md/[[...path]]` segments that correspond to a paid guide. */
export function isPaidMarkdownSegments(path: readonly string[]): boolean {
  if (path.length === 2 && path[0] === "airports" && path[1]) {
    return true;
  }
  if (
    path.length === 4 &&
    path[0] === "airports" &&
    path[2] === "lounge" &&
    path[1] &&
    path[3]
  ) {
    return true;
  }
  return false;
}

export function getX402SellerConfig(
  env: X402Env = process.env,
): X402SellerConfig | null {
  const payTo = readX402PayTo(env);
  if (!payTo) {
    return null;
  }
  return {
    payTo,
    network: asNetwork(readTrimmed(env, "X402_NETWORK") ?? DEFAULT_X402_NETWORK),
    facilitatorUrl:
      readTrimmed(env, "X402_FACILITATOR_URL") ?? DEFAULT_X402_FACILITATOR_URL,
    price: readTrimmed(env, "X402_PRICE") ?? DEFAULT_X402_PRICE,
  };
}

export function paidMarkdownRouteConfig(config: X402SellerConfig): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      price: config.price,
      network: config.network,
      payTo: config.payTo,
    },
    description: "HonestAirport airport or lounge markdown guide",
    mimeType: "text/markdown",
  };
}

export function createX402ResourceServer(
  config: X402SellerConfig,
  facilitator?: FacilitatorClient,
): x402ResourceServer {
  const client =
    facilitator ?? new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  return new x402ResourceServer(client).register(
    "eip155:*",
    new ExactEvmScheme(),
  );
}

export function getOrCreateX402Server(
  config: X402SellerConfig,
  facilitator?: FacilitatorClient,
): x402ResourceServer {
  const key = `${config.payTo}|${config.network}|${config.facilitatorUrl}`;
  if (!facilitator && cachedServer?.key === key) {
    return cachedServer.server;
  }
  const server = createX402ResourceServer(config, facilitator);
  if (!facilitator) {
    cachedServer = { key, server };
  }
  return server;
}

/** Test helper — drop the cached facilitator-backed server. */
export function resetX402ServerCache(): void {
  cachedServer = null;
}

export function paidMarkdownResourceUrl(
  request: NextRequest,
  path: readonly string[],
): string {
  const mdPath = path.length === 0 ? "/md" : `/md/${path.join("/")}`;
  const publicPath = publicMarkdownPath(mdPath);
  return new URL(publicPath ?? request.nextUrl.pathname, request.url).href;
}

function toNextResponse(response: Response): NextResponse {
  if (response instanceof NextResponse) {
    return response;
  }
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export type PaidMarkdownGateOptions = {
  env?: X402Env;
  server?: x402ResourceServer;
  /** Defaults to true in production so the facilitator can advertise USDC details. */
  syncFacilitatorOnStart?: boolean;
};

/**
 * Run `serve` unchanged when the paywall is off or the path is free.
 * Paid airport/lounge markdown goes through `withX402` so unpaid clients get
 * HTTP 402 + `PAYMENT-REQUIRED`, and settlement happens only after status < 400.
 */
export async function handleMarkdownWithOptionalPayment(
  request: NextRequest,
  path: readonly string[],
  serve: () => Promise<Response>,
  options: PaidMarkdownGateOptions = {},
): Promise<Response> {
  const env = options.env ?? process.env;
  const config = getX402SellerConfig(env);
  if (!config || !isPaidMarkdownSegments(path)) {
    return serve();
  }

  const server = options.server ?? getOrCreateX402Server(config);
  const handler = async () => toNextResponse(await serve());

  return withX402(
    handler,
    {
      ...paidMarkdownRouteConfig(config),
      resource: paidMarkdownResourceUrl(request, path),
    },
    server,
    undefined,
    undefined,
    options.syncFacilitatorOnStart ?? true,
  )(request);
}
