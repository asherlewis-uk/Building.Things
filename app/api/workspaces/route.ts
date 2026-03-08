import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import { createWorkspace, listWorkspaces } from "@/lib/services/workspaces";

type CreateWorkspaceBody = {
  name?: unknown;
};

export async function GET() {
  try {
    const workspaces = await listWorkspaces();
    return NextResponse.json(workspaces);
  } catch (error) {
    return toErrorResponse(error, "Failed to load workspaces");
  }
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<CreateWorkspaceBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const workspace = await createWorkspace(parsedBody.data);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create workspace");
  }
}
