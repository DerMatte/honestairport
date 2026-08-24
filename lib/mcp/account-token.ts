import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { secretsEqual } from "@/lib/request-security";
import {
  authenticateMcpToken,
  hashMcpToken,
  toMcpTokenStatus,
  type GeneratedMcpToken,
  type McpTokenStatus,
  type McpTokenUser,
} from "@/lib/mcp/tokens";

export async function findUserByMcpTokenHash(
  hash: string,
): Promise<McpTokenUser | null> {
  const [row] = await getDb()
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      whopUserId: user.whopUserId,
      mcpTokenHash: user.mcpTokenHash,
    })
    .from(user)
    .where(eq(user.mcpTokenHash, hash))
    .limit(1);

  if (!row?.mcpTokenHash || !secretsEqual(hash, row.mcpTokenHash)) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    whopUserId: row.whopUserId,
  };
}

export async function verifyStoredMcpToken(
  raw: string | null | undefined,
): Promise<McpTokenUser | null> {
  return authenticateMcpToken(raw, findUserByMcpTokenHash);
}

export async function getMcpTokenStatusForUser(
  userId: string,
): Promise<McpTokenStatus> {
  const [row] = await getDb()
    .select({
      mcpTokenPrefix: user.mcpTokenPrefix,
      mcpTokenCreatedAt: user.mcpTokenCreatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return toMcpTokenStatus(row ?? null);
}

export async function persistMcpToken(
  userId: string,
  token: GeneratedMcpToken,
): Promise<void> {
  await getDb()
    .update(user)
    .set({
      mcpTokenHash: token.hash,
      mcpTokenPrefix: token.prefix,
      mcpTokenCreatedAt: token.createdAt,
      updatedAt: token.createdAt,
    })
    .where(eq(user.id, userId));
}

export async function revokeMcpToken(userId: string): Promise<void> {
  await getDb()
    .update(user)
    .set({
      mcpTokenHash: null,
      mcpTokenPrefix: null,
      mcpTokenCreatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

/** Test helper — hash a known raw token the same way the API would store it. */
export function storedHashForRawToken(raw: string): string {
  return hashMcpToken(raw);
}
