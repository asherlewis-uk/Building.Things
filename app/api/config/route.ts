import { NextRequest, NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  getResolvedConfig,
  updateAppSettings,
  updateWorkspaceSettings,
} from "@/lib/services/config";
import { resolveWorkspaceId } from "@/lib/services/workspaces";

type UpdateConfigBody = {
  workspace_id?: unknown;
  app?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  try {
    const workspaceId = await resolveWorkspaceId(
      req.nextUrl.searchParams.get("workspace_id") ?? "active",
    );
    const config = await getResolvedConfig(workspaceId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error, "Failed to load config");
  }
}

export async function PUT(req: Request) {
  try {
    const parsedBody = await parseRequestJson<UpdateConfigBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const workspaceId = await resolveWorkspaceId(parsedBody.data.workspace_id);

    if (parsedBody.data.app && typeof parsedBody.data.app === "object") {
      await updateAppSettings(parsedBody.data.app);
    }

    if (parsedBody.data.workspace && typeof parsedBody.data.workspace === "object") {
      await updateWorkspaceSettings(workspaceId, parsedBody.data.workspace);
    }

    const config = await getResolvedConfig(workspaceId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error, "Failed to update config");
  }
}
