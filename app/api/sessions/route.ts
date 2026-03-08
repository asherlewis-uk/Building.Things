import { NextRequest, NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  createSession,
  listSessions,
  resolveWorkspaceId,
} from "@/lib/services/workspaces";

type CreateSessionBody = {
  title?: unknown;
  workspace_id?: unknown;
  mode?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const workspaceId = await resolveWorkspaceId(
      req.nextUrl.searchParams.get("workspace_id") ?? "active",
    );
    const includeArchived =
      req.nextUrl.searchParams.get("include_archived") === "1";
    const sessions = await listSessions(workspaceId, {
      includeArchived,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    return toErrorResponse(error, "Failed to load sessions");
  }
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<CreateSessionBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const session = await createSession(parsedBody.data);

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create session");
  }
}
