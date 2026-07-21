import {
  createAgentUIStreamResponse,
  validateUIMessages,
} from "ai";
import { z } from "zod";
import {
  honestAirportAgent,
  type HonestAirportAssistantMessage,
} from "@/lib/assistant/honest-airport-agent";
import { honestAirportTools } from "@/lib/assistant/airport-tools";
import {
  assertSameOrigin,
  consumeRateLimit,
  hashClientIp,
} from "@/lib/request-security";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 16;
const MAX_TEXT_CHARACTERS = 12_000;
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES),
});

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: noStoreHeaders });
}

function countTextCharacters(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countTextCharacters(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (total, item) => total + countTextCharacters(item),
      0,
    );
  }
  return 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!assertSameOrigin(request)) {
    return errorResponse("Cross-origin assistant requests are not allowed.", 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Expected an application/json request.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse("Assistant request is too large.", 413);
  }

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return errorResponse(
      "Ask HonestAirport is not configured on this deployment.",
      503,
    );
  }

  const ipHash = hashClientIp(request);
  if (ipHash) {
    try {
      const allowed = await consumeRateLimit(
        `assistant:${ipHash}`,
        RATE_LIMIT_REQUESTS,
        RATE_LIMIT_WINDOW_MS,
      );
      if (!allowed) {
        return errorResponse(
          "Too many assistant requests. Please try again in a few minutes.",
          429,
        );
      }
    } catch (error) {
      console.error("Assistant rate limit unavailable", error);
      return errorResponse("Ask HonestAirport is temporarily unavailable.", 503);
    }
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return errorResponse("Assistant request is too large.", 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid assistant request.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success || countTextCharacters(parsed.data.messages) > MAX_TEXT_CHARACTERS) {
    return errorResponse("Invalid or oversized message history.", 400);
  }

  if (
    parsed.data.messages.some(
      (message) =>
        !message ||
        typeof message !== "object" ||
        ("role" in message && message.role === "system"),
    )
  ) {
    return errorResponse("System messages are not accepted.", 400);
  }

  let messages: HonestAirportAssistantMessage[];
  try {
    messages = await validateUIMessages<HonestAirportAssistantMessage>({
      messages: parsed.data.messages,
      tools: honestAirportTools,
    });
  } catch {
    return errorResponse("Invalid message format.", 400);
  }

  return createAgentUIStreamResponse({
    agent: honestAirportAgent,
    uiMessages: messages,
    abortSignal: request.signal,
    timeout: { totalMs: 45_000 },
    headers: noStoreHeaders,
    sendReasoning: false,
    onError: (error) => {
      console.error("Ask HonestAirport stream failed", error);
      return "Ask HonestAirport could not complete that request. Please try again.";
    },
  });
}
