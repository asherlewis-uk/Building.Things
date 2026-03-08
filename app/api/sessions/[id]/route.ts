import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  deleteSession,
  requireSession,
  updateSession,
} from "@/lib/services/workspaces";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateSessionBody = {
  title?: unknown;
  mode?: unknown;
  archived?: unknown;
  restore?: unknown;
};

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const session = await requireSession(id);

    return NextResponse.json(session);
  } catch (error) {
    return toErrorResponse(error, "Failed to load session");
  }
}

export async function PATCH(req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<UpdateSessionBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const session = await updateSession(id, parsedBody.data);
    return NextResponse.json(session);
  } catch (error) {
    return toErrorResponse(error, "Failed to update session");
  }
}

export async function DELETE(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    await deleteSession(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete session");
  }
}
