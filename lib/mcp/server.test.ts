import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { authenticateMcpToken, generateMcpToken, type McpTokenUser } from "./tokens";
import { handleMcpRequest } from "./server";

const USER: McpTokenUser = {
  id: "user-1",
  email: "traveler@example.com",
  name: "Traveler",
};

function mcpRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://www.honestairport.com/mcp", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "honestairport-tests", version: "0" },
      },
    }),
  });
}

describe("handleMcpRequest auth", () => {
  const token = generateMcpToken();
  const lookup = async (raw: string | null | undefined) =>
    authenticateMcpToken(raw, (hash) => (hash === token.hash ? USER : null));

  it("returns 401 without a token", async () => {
    const response = await handleMcpRequest(mcpRequest(), { lookup, env: {} });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
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
