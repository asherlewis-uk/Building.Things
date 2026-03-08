import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api";
import { testMcpServer } from "@/lib/services/mcp";

type McpTestRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: McpTestRouteContext) {
  try {
    const { id } = await params;
    const server = await testMcpServer(id);
    return NextResponse.json(server);
  } catch (error) {
    return toErrorResponse(error, "Failed to validate MCP server");
  }
}
