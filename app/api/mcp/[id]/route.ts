import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  deleteMcpServer,
  requireMcpServer,
  updateMcpServer,
} from "@/lib/services/mcp";

type McpRouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateMcpBody = {
  name?: unknown;
  transport_type?: unknown;
  endpoint?: unknown;
  command?: unknown;
  auth_mode?: unknown;
  enabled?: unknown;
  declared_tools?: unknown;
};

export async function GET(_req: Request, { params }: McpRouteContext) {
  try {
    const { id } = await params;
    const server = await requireMcpServer(id);
    return NextResponse.json(server);
  } catch (error) {
    return toErrorResponse(error, "Failed to load MCP server");
  }
}

export async function PATCH(req: Request, { params }: McpRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<UpdateMcpBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const server = await updateMcpServer(id, parsedBody.data);
    return NextResponse.json(server);
  } catch (error) {
    return toErrorResponse(error, "Failed to update MCP server");
  }
}

export async function DELETE(_req: Request, { params }: McpRouteContext) {
  try {
    const { id } = await params;
    await deleteMcpServer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete MCP server");
  }
}
