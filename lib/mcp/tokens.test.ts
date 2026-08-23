import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeMcpRequest, mcpUnauthorizedResponse } from "./auth";
import {
  authenticateMcpToken,
  extractMcpToken,
  generateMcpToken,
  hashMcpToken,
  isMcpTokenFormat,
  issueMcpTokenForUser,
  MCP_TOKEN_KIND,
  parseBearerAuthorization,
  toMcpTokenStatus,
  type GeneratedMcpToken,
  type McpTokenUser,
} from "./tokens";

const USER: McpTokenUser = {
  id: "user-1",
  email: "traveler@example.com",
  name: "Traveler",
};

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://www.honestairport.com/mcp", {
    method: "POST",
    headers,
  });
}

describe("MCP token format", () => {
  it("generates a hashed token that never equals the raw secret", () => {
    const token = generateMcpToken(new Date("2026-08-23T12:00:00.000Z"));
    assert.ok(token.raw.startsWith(MCP_TOKEN_KIND));
    assert.equal(isMcpTokenFormat(token.raw), true);
    assert.equal(token.hash, hashMcpToken(token.raw));
    assert.notEqual(token.hash, token.raw);
    assert.ok(token.prefix.startsWith(MCP_TOKEN_KIND));
    assert.ok(token.raw.startsWith(token.prefix));
    assert.ok(token.raw.length > token.prefix.length);
  });

  it("rejects garbage and truncated secrets", () => {
    assert.equal(isMcpTokenFormat(""), false);
    assert.equal(isMcpTokenFormat("not-a-token"), false);
    assert.equal(isMcpTokenFormat("ha_mcp_short"), false);
    assert.equal(isMcpTokenFormat("ha_mcp_has spaces and more!!!!"), false);
  });
});

describe("Bearer extraction", () => {
  it("reads Authorization: Bearer and Mcp-Session", () => {
    assert.equal(parseBearerAuthorization(null), null);
    assert.equal(parseBearerAuthorization("Basic abc"), null);
    assert.equal(
      parseBearerAuthorization("Bearer ha_mcp_abcdefghijklmnopqrstuv"),
      "ha_mcp_abcdefghijklmnopqrstuv",
    );
    assert.equal(
      extractMcpToken(
        requestWith({ authorization: "Bearer ha_mcp_abcdefghijklmnopqrstuv" }),
      ),
      "ha_mcp_abcdefghijklmnopqrstuv",
    );
    assert.equal(
      extractMcpToken(requestWith({ "mcp-session": "ha_mcp_from_session_header" })),
      "ha_mcp_from_session_header",
    );
  });
});

describe("authenticateMcpToken / authorizeMcpRequest", () => {
  it("returns 401 without a token", async () => {
    const missing = await authorizeMcpRequest(requestWith({}), async () => USER);
    assert.ok("response" in missing);
    assert.equal(missing.response.status, 401);
    const body = (await missing.response.json()) as { reason: string };
    assert.equal(body.reason, "missing");
  });

  it("returns 401 with a garbage token", async () => {
    const garbage = await authorizeMcpRequest(
      requestWith({ authorization: "Bearer totally-not-valid" }),
      (raw) => authenticateMcpToken(raw, async () => USER),
    );
    assert.ok("response" in garbage);
    assert.equal(garbage.response.status, 401);
    const body = (await garbage.response.json()) as { reason: string };
    assert.equal(body.reason, "invalid");
  });

  it("maps a valid token to the owning user via the stored hash", async () => {
    const token = generateMcpToken();
    const lookup = async (raw: string | null | undefined) =>
      authenticateMcpToken(raw, (hash) =>
        hash === token.hash ? USER : null,
      );

    const authorized = await authorizeMcpRequest(
      requestWith({ authorization: `Bearer ${token.raw}` }),
      lookup,
    );
    assert.ok("user" in authorized);
    assert.deepEqual(authorized.user, USER);

    const unknown = await authorizeMcpRequest(
      requestWith({ authorization: `Bearer ${generateMcpToken().raw}` }),
      lookup,
    );
    assert.ok("response" in unknown);
    assert.equal(unknown.response.status, 401);
  });

  it("sets WWW-Authenticate on 401", () => {
    const response = mcpUnauthorizedResponse("missing");
    assert.match(response.headers.get("WWW-Authenticate") ?? "", /Bearer/);
  });
});

describe("issueMcpTokenForUser", () => {
  it("persists a hash bound to the session user id", async () => {
    const stored: Array<{ userId: string; token: GeneratedMcpToken }> = [];
    const issued = await issueMcpTokenForUser(
      "user-1",
      async (userId, token) => {
        stored.push({ userId, token });
      },
      new Date("2026-08-23T12:00:00.000Z"),
    );

    assert.equal(stored.length, 1);
    assert.equal(stored[0].userId, "user-1");
    assert.equal(hashMcpToken(issued.raw), stored[0].token.hash);
    assert.equal(issued.status.hasToken, true);
    assert.equal(issued.status.prefix, stored[0].token.prefix);
    assert.equal(issued.status.createdAt, "2026-08-23T12:00:00.000Z");
  });

  it("refuses to issue without a user id", async () => {
    await assert.rejects(
      () => issueMcpTokenForUser("  ", async () => undefined),
      /user id/,
    );
  });
});

describe("toMcpTokenStatus", () => {
  it("hides the raw token and reports prefix only", () => {
    assert.deepEqual(toMcpTokenStatus(null), {
      hasToken: false,
      prefix: null,
      createdAt: null,
    });
    assert.deepEqual(
      toMcpTokenStatus({
        mcpTokenPrefix: "ha_mcp_abcd",
        mcpTokenCreatedAt: new Date("2026-08-23T12:00:00.000Z"),
      }),
      {
        hasToken: true,
        prefix: "ha_mcp_abcd",
        createdAt: "2026-08-23T12:00:00.000Z",
      },
    );
  });
});
