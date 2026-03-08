import { NextRequest, NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import { createMcpServer, listMcpServers } from "@/lib/services/mcp";
import { resolveWorkspaceId } from "@/lib/services/workspaces";

type CreateMcpBody = {
  workspace_id?: unknown;
  name?: unknown;
  transport_type?: unknown;
  endpoint?: unknown;
  command?: unknown;
  auth_mode?: unknown;
  enabled?: unknown;
  declared_tools?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const workspaceId = await resolveWorkspaceId(
      req.nextUrl.searchParams.get("workspace_id") ?? "active",
    );
    const servers = await listMcpServers(workspaceId);
    return NextResponse.json(servers);
  } catch (error) {
    return toErrorResponse(error, "Failed to load MCP servers");
  }
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<CreateMcpBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const workspaceId = await resolveWorkspaceId(parsedBody.data.workspace_id);
    const server = await createMcpServer({
      ...parsedBody.data,
      workspace_id: workspaceId,
    });
    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create MCP server");
  }
}
