/**
 * Env-gated x402 paywall for machine-readable paid airport intel.
 *
 * Free: home / sitemap / llms.txt, airport overview `.md`, and the lounge
 * *directory* (`/airports/{iata}/lounges.md`). Paid: extra airport tabs and
 * individual lounge pages. Off unless `X402_PAY_TO` is set.
 *
 * Settlement uses `withX402` (status < 400 only), so 404s never charge.
 * Paid 200s and 402s use `private, no-store` so a CDN cannot replay a body.
 */
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type RouteConfig,
} from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  withX402FromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import { isPaidAirportTab } from "@/lib/airport-tabs";
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
/** Paid guide bodies and 402s must not land on a shared CDN. */
export const PAID_MARKDOWN_CACHE_CONTROL = "private, no-store";

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

const LOUNGE_PUBLIC_MD = /^\/airports\/([^/]+)\/lounge\/([^/]+)\.md$/;
const LOUNGE_INTERNAL_MD = /^\/md\/airports\/([^/]+)\/lounge\/([^/]+)$/;
const TAB_PUBLIC_MD = /^\/airports\/([^/]+)\/([^/]+)\.md$/;
const TAB_INTERNAL_MD = /^\/md\/airports\/([^/]+)\/([^/]+)$/;

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
 * Paid machine-API paths: individual lounge markdown and extra airport-tab
 * markdown (public `.md` or internal `/md/...`). Overview `.md`, the lounge
 * directory, HTML, `/`, `/index.md`, `/sitemap.md`, and `/llms.txt` are free.
 */
export function isPaidMarkdownPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (LOUNGE_PUBLIC_MD.test(path) || LOUNGE_INTERNAL_MD.test(path)) {
    return true;
  }
  const publicTab = TAB_PUBLIC_MD.exec(path);
  if (publicTab && isPaidAirportTab(publicTab[2])) {
    return true;
  }
  const internalTab = TAB_INTERNAL_MD.exec(path);
  if (internalTab && isPaidAirportTab(internalTab[2])) {
    return true;
  }
  return false;
}

/** Catch-all `/md/[[...path]]` segments that correspond to a paid guide. */
export function isPaidMarkdownSegments(path: readonly string[]): boolean {
  if (
    path.length === 4 &&
    path[0] === "airports" &&
    path[2] === "lounge" &&
    path[1] &&
    path[3]
  ) {
    return true;
  }
  if (
    path.length === 3 &&
    path[0] === "airports" &&
    path[1] &&
    path[2] &&
    isPaidAirportTab(path[2])
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

/** Drop public / s-maxage so Vercel CDN cannot replay a paid body. */
export function withoutPublicMarkdownCache(response: Response): Response {
  response.headers.set("Cache-Control", PAID_MARKDOWN_CACHE_CONTROL);
  return response;
}

export type PaidMarkdownGateOptions = {
  env?: X402Env;
  server?: x402ResourceServer;
  /** Defaults to true in production so the facilitator can advertise USDC details. */
  syncFacilitatorOnStart?: boolean;
  /** Test seam: run the handler without a PAYMENT-SIGNATURE. */
  grantAccessWithoutPayment?: boolean;
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
  const handler = async () =>
    toNextResponse(withoutPublicMarkdownCache(await serve()));

  const httpServer = new x402HTTPResourceServer(server, {
    "*": {
      ...paidMarkdownRouteConfig(config),
      resource: paidMarkdownResourceUrl(request, path),
    },
  });
  if (options.grantAccessWithoutPayment) {
    httpServer.onProtectedRequest(async () => ({ grantAccess: true }));
  }

  const gated = await withX402FromHTTPServer(
    handler,
    httpServer,
    undefined,
    undefined,
    options.syncFacilitatorOnStart ?? true,
  )(request);

  return withoutPublicMarkdownCache(gated);
}
