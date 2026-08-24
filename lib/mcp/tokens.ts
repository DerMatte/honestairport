import { createHash, randomBytes } from "node:crypto";

/** Public prefix so leaked tokens are recognizable in logs and settings. */
export const MCP_TOKEN_KIND = "ha_mcp_";
const RANDOM_BYTES = 32;
const DISPLAY_SECRET_CHARS = 4;

export type GeneratedMcpToken = {
  raw: string;
  hash: string;
  prefix: string;
  createdAt: Date;
};

export type McpTokenUser = {
  id: string;
  email: string;
  name: string;
  /** Stored Whop user id for account-based membership skip (not a cookie). */
  whopUserId?: string | null;
};

export type McpTokenStatus = {
  hasToken: boolean;
  prefix: string | null;
  createdAt: string | null;
};

export function hashMcpToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function mcpTokenDisplayPrefix(raw: string): string {
  return raw.slice(0, MCP_TOKEN_KIND.length + DISPLAY_SECRET_CHARS);
}

export function isMcpTokenFormat(raw: string): boolean {
  return (
    raw.startsWith(MCP_TOKEN_KIND) &&
    raw.length >= MCP_TOKEN_KIND.length + 16 &&
    raw.length <= 200 &&
    /^[A-Za-z0-9_-]+$/.test(raw)
  );
}

export function generateMcpToken(now: Date = new Date()): GeneratedMcpToken {
  const raw = `${MCP_TOKEN_KIND}${randomBytes(RANDOM_BYTES).toString("base64url")}`;
  return {
    raw,
    hash: hashMcpToken(raw),
    prefix: mcpTokenDisplayPrefix(raw),
    createdAt: now,
  };
}

export function parseBearerAuthorization(
  header: string | null | undefined,
): string | null {
  if (!header) {
    return null;
  }
  const match = header.match(/^Bearer\s+(\S+)\s*$/i);
  const token = match?.[1] ?? null;
  return token && token.length > 0 ? token : null;
}

/**
 * MCP clients send `Authorization: Bearer <token>`. A few also stash the
 * PAT on `Mcp-Session` — accept that as an equivalent, not a session id.
 */
export function extractMcpToken(request: Request): string | null {
  const bearer = parseBearerAuthorization(request.headers.get("authorization"));
  if (bearer) {
    return bearer;
  }
  const session = request.headers.get("mcp-session")?.trim();
  return session && session.length > 0 ? session : null;
}

export function toMcpTokenStatus(row: {
  mcpTokenPrefix?: string | null;
  mcpTokenCreatedAt?: Date | null;
  prefix?: string | null;
  createdAt?: Date | null;
} | null): McpTokenStatus {
  const prefix = row?.mcpTokenPrefix ?? row?.prefix ?? null;
  const created = row?.mcpTokenCreatedAt ?? row?.createdAt ?? null;
  return {
    hasToken: Boolean(prefix),
    prefix,
    createdAt: created ? created.toISOString() : null,
  };
}

export async function authenticateMcpToken(
  raw: string | null | undefined,
  lookup: (
    hash: string,
  ) => Promise<McpTokenUser | null> | McpTokenUser | null,
): Promise<McpTokenUser | null> {
  if (!raw || !isMcpTokenFormat(raw)) {
    return null;
  }
  return lookup(hashMcpToken(raw));
}

export async function issueMcpTokenForUser(
  userId: string,
  persist: (userId: string, token: GeneratedMcpToken) => Promise<void>,
  now: Date = new Date(),
): Promise<{ raw: string; status: McpTokenStatus }> {
  if (!userId.trim()) {
    throw new Error("Cannot issue an MCP token without a user id");
  }
  const token = generateMcpToken(now);
  await persist(userId, token);
  return {
    raw: token.raw,
    status: {
      hasToken: true,
      prefix: token.prefix,
      createdAt: token.createdAt.toISOString(),
    },
  };
}
