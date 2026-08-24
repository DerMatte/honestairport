import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getMcpTokenStatusForUser,
  persistMcpToken,
  revokeMcpToken,
} from "@/lib/mcp/account-token";
import { issueMcpTokenForUser } from "@/lib/mcp/tokens";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const GENERATE_LIMIT = 8;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

async function requireSessionUser(request: Request) {
  if (!isDatabaseConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Account features are not configured" },
        { status: 503 },
      ),
    };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      error: NextResponse.json({ error: "Sign in to manage your MCP token." }, { status: 401 }),
    };
  }

  return { userId: session.user.id };
}

export async function GET(request: Request) {
  const session = await requireSessionUser(request);
  if ("error" in session) {
    return session.error;
  }

  const status = await getMcpTokenStatusForUser(session.userId);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await requireSessionUser(request);
  if ("error" in session) {
    return session.error;
  }

  const allowed = await consumeRateLimit(
    `mcp-token:${session.userId}`,
    GENERATE_LIMIT,
    GENERATE_WINDOW_MS,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many token requests. Try again later." },
      { status: 429 },
    );
  }

  const issued = await issueMcpTokenForUser(session.userId, persistMcpToken);
  return NextResponse.json(
    {
      token: issued.raw,
      ...issued.status,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await requireSessionUser(request);
  if ("error" in session) {
    return session.error;
  }

  await revokeMcpToken(session.userId);
  return NextResponse.json(
    { hasToken: false, prefix: null, createdAt: null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
