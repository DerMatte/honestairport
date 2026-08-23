import { NextRequest } from "next/server";
import { handleMcpRequest, mcpCorsPreflight } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return mcpCorsPreflight();
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
