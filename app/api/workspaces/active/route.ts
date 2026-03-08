import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  getActiveWorkspace,
  updateActiveWorkspace,
} from "@/lib/services/workspaces";

type UpdateActiveWorkspaceBody = {
  workspace_id?: unknown;
};

export async function GET() {
  try {
    const workspace = await getActiveWorkspace();
    return NextResponse.json(workspace);
  } catch (error) {
    return toErrorResponse(error, "Failed to load the active workspace");
  }
}

export async function PUT(req: Request) {
  try {
    const parsedBody = await parseRequestJson<UpdateActiveWorkspaceBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    if (typeof parsedBody.data.workspace_id !== "string" || !parsedBody.data.workspace_id.trim()) {
      return NextResponse.json(
        {
          error: "Invalid workspace payload",
          fieldErrors: {
            workspace_id: "Workspace id is required.",
          },
        },
        { status: 400 },
      );
    }

    const workspace = await updateActiveWorkspace(parsedBody.data.workspace_id);
    return NextResponse.json(workspace);
  } catch (error) {
    return toErrorResponse(error, "Failed to update the active workspace");
  }
}
