import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  deleteWorkspace,
  requireWorkspace,
  updateWorkspace,
} from "@/lib/services/workspaces";

type WorkspaceRouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateWorkspaceBody = {
  name?: unknown;
};

export async function GET(_req: Request, { params }: WorkspaceRouteContext) {
  try {
    const { id } = await params;
    const workspace = await requireWorkspace(id);
    return NextResponse.json(workspace);
  } catch (error) {
    return toErrorResponse(error, "Failed to load workspace");
  }
}

export async function PATCH(req: Request, { params }: WorkspaceRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<UpdateWorkspaceBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const workspace = await updateWorkspace(id, parsedBody.data);
    return NextResponse.json(workspace);
  } catch (error) {
    return toErrorResponse(error, "Failed to update workspace");
  }
}

export async function DELETE(_req: Request, { params }: WorkspaceRouteContext) {
  try {
    const { id } = await params;
    await deleteWorkspace(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete workspace");
  }
}
