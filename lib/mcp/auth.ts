import { extractMcpToken, type McpTokenUser } from "@/lib/mcp/tokens";
import { verifyStoredMcpToken } from "@/lib/mcp/account-token";

export const MCP_WWW_AUTHENTICATE =
  'Bearer realm="HonestAirport MCP", error="invalid_token"';

export function mcpUnauthorizedResponse(
  reason: "missing" | "invalid",
): Response {
  const message =
    reason === "missing"
      ? "Missing MCP token. Create one at /settings and send Authorization: Bearer <token>."
      : "Invalid MCP token.";

  return new Response(JSON.stringify({ error: "Unauthorized", reason, message }), {
    status: 401,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "WWW-Authenticate": MCP_WWW_AUTHENTICATE,
      "Cache-Control": "private, no-store",
    },
  });
}

export type McpAuthLookup = (
  raw: string | null | undefined,
) => Promise<McpTokenUser | null> | McpTokenUser | null;

export async function authorizeMcpRequest(
  request: Request,
  lookup: McpAuthLookup = verifyStoredMcpToken,
): Promise<{ user: McpTokenUser } | { response: Response }> {
  const raw = extractMcpToken(request);
  if (!raw) {
    return { response: mcpUnauthorizedResponse("missing") };
  }

  const user = await lookup(raw);
  if (!user) {
    return { response: mcpUnauthorizedResponse("invalid") };
  }

  return { user };
}
