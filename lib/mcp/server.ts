import { createMcpHandler } from "mcp-handler";
import { NextRequest } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/db";
import { authorizeMcpRequest, type McpAuthLookup } from "@/lib/mcp/auth";
import {
  executeGetAirport,
  executeGetLounge,
  executeListLounges,
  executeListMajorAirports,
  executeSearchAirports,
  loadPaidToolMarkdown,
  parsePaidMcpToolCall,
  type PaidMcpToolCall,
} from "@/lib/mcp/tools";
import { markdownResponse } from "@/lib/page-markdown";
import {
  userHasLiveWhopMembership,
  type CheckWhopProductAccess,
} from "@/lib/whop-access";
import {
  handleMarkdownWithOptionalPayment,
  isX402Enabled,
  type PaidMarkdownGateOptions,
  type X402Env,
} from "@/lib/x402";

export const MCP_CORS_ALLOW_HEADERS = [
  "Authorization",
  "Content-Type",
  "Accept",
  "MCP-Protocol-Version",
  "Mcp-Session-Id",
  "Mcp-Session",
  "Last-Event-ID",
  "PAYMENT-SIGNATURE",
  "PAYMENT-REQUIRED",
].join(", ");

export const MCP_CORS_EXPOSE_HEADERS = [
  "WWW-Authenticate",
  "PAYMENT-REQUIRED",
  "Mcp-Session-Id",
].join(", ");

const iataSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{3}$/, "Use a three-letter IATA code");

const iataInput = z.object({
  iata: iataSchema,
});

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_airports",
      {
        title: "Search airports",
        description:
          "Search HonestAirport's airport directory by IATA, name, city, or country. Returns up to 10 matches.",
        inputSchema: z.object({
          query: z.string().trim().min(1).max(80),
        }),
      },
      async ({ query }) => executeSearchAirports(query),
    );

    server.registerTool(
      "get_airport",
      {
        title: "Get airport guide",
        description:
          "Airport markdown guide plus Airportist Score summary — the same document as /airports/{iata}.md.",
        inputSchema: iataInput,
      },
      async ({ iata }) => executeGetAirport(iata),
    );

    server.registerTool(
      "list_lounges",
      {
        title: "List lounges",
        description: "List lounge names and slugs for one airport.",
        inputSchema: iataInput,
      },
      async ({ iata }) => executeListLounges(iata),
    );

    server.registerTool(
      "get_lounge",
      {
        title: "Get lounge guide",
        description:
          "Lounge markdown — the same document as /airports/{iata}/lounge/{slug}.md.",
        inputSchema: z.object({
          iata: iataSchema,
          slug: z.string().trim().min(1).max(120),
        }),
      },
      async ({ iata, slug }) => executeGetLounge(iata, slug),
    );

    server.registerTool(
      "list_major_airports",
      {
        title: "List major airports",
        description:
          "Ranked major airports from HonestAirport's traffic list (ACI-style majors).",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(100).optional(),
        }),
      },
      async ({ limit }) => executeListMajorAirports(limit),
    );
  },
  {
    serverInfo: {
      name: "honestairport",
      version: "0.1.0",
    },
    instructions:
      "HonestAirport traveler guides. Authenticate with a personal access token from /settings (Authorization: Bearer). Use search_airports or list_major_airports to find an IATA, then get_airport / list_lounges / get_lounge.",
  },
);

export function withMcpCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", MCP_CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Expose-Headers", MCP_CORS_EXPOSE_HEADERS);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function mcpCorsPreflight(): Response {
  return withMcpCors(new Response(null, { status: 204 }));
}

export type HandleMcpRequestOptions = {
  lookup?: McpAuthLookup;
  env?: X402Env;
  /** Test seam: lounge markdown used only to decide whether to 402. */
  loadPaidToolMarkdown?: (paid: PaidMcpToolCall) => Promise<string | null>;
  /** Test seam: replace `users.checkAccess`. */
  checkWhopAccess?: CheckWhopProductAccess;
} & Pick<
  PaidMarkdownGateOptions,
  "server" | "syncFacilitatorOnStart" | "grantAccessWithoutPayment"
>;

async function gatePaidToolIfNeeded(
  request: NextRequest,
  options: HandleMcpRequestOptions,
  grantAccessWithoutPayment: boolean,
): Promise<Response | null> {
  if (request.method !== "POST" || !isX402Enabled(options.env ?? process.env)) {
    return null;
  }

  let body: unknown = null;
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }

  const paid = parsePaidMcpToolCall(body);
  if (!paid) {
    return null;
  }

  const loadMarkdown = options.loadPaidToolMarkdown ?? loadPaidToolMarkdown;
  const markdown = await loadMarkdown(paid);
  if (!markdown) {
    return null;
  }

  const gated = await handleMarkdownWithOptionalPayment(
    request,
    [...paid.segments],
    async () => markdownResponse(markdown),
    {
      env: options.env,
      server: options.server,
      syncFacilitatorOnStart: options.syncFacilitatorOnStart,
      grantAccessWithoutPayment,
    },
  );

  if (gated.status === 402) {
    return gated;
  }

  return null;
}

/**
 * Auth is mandatory. x402 (when `X402_PAY_TO` is set) can still 402
 * get_lounge after a valid token — never instead of one, and never
 * get_airport. A live Whop membership on the account skips the charge.
 */
export async function handleMcpRequest(
  request: NextRequest,
  options: HandleMcpRequestOptions = {},
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return mcpCorsPreflight();
  }

  if (!options.lookup && !isDatabaseConfigured()) {
    return withMcpCors(
      new Response(
        JSON.stringify({
          error: "Service unavailable",
          message: "MCP requires a configured database.",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "private, no-store",
          },
        },
      ),
    );
  }

  const authorized = await authorizeMcpRequest(request, options.lookup);
  if ("response" in authorized) {
    return withMcpCors(authorized.response);
  }

  const env = options.env ?? process.env;
  const grantAccessWithoutPayment =
    options.grantAccessWithoutPayment === true ||
    (await userHasLiveWhopMembership(
      authorized.user,
      env,
      options.checkWhopAccess,
    ));

  const paidGate = await gatePaidToolIfNeeded(
    request,
    { ...options, env },
    grantAccessWithoutPayment,
  );
  if (paidGate) {
    return withMcpCors(paidGate);
  }

  return withMcpCors(await mcpHandler(request));
}
