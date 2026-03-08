import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb, getDefaultWorkspaceId } from "@/lib/db";
import type { Session } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

type CreateSessionBody = {
  title?: unknown;
  workspace_id?: unknown;
};

export async function GET() {
  try {
    const db = await getDb();
    const sessions = await db.all<Session[]>(
      "SELECT * FROM sessions ORDER BY updated_at DESC, created_at DESC",
    );
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

    const { title, workspace_id } = parsedBody.data;
    const db = await getDb();
    const resolvedTitle = trimString(title) ?? "New Session";

    if (resolvedTitle.length > 120) {
      throw new ApiRouteError("Invalid session payload", 400, undefined, {
        title: "Title must be 120 characters or fewer.",
      });
    }

    let resolvedWorkspaceId = await getDefaultWorkspaceId();

    if (typeof workspace_id === "string" && workspace_id !== "default") {
      const workspace = await db.get<{ id: string }>(
        "SELECT id FROM workspaces WHERE id = ?",
        [workspace_id],
      );

      if (!workspace?.id) {
        throw new ApiRouteError("Workspace not found", 404);
      }

      resolvedWorkspaceId = workspace.id;
    } else if (
      workspace_id !== undefined &&
      workspace_id !== null &&
      workspace_id !== "default"
    ) {
      throw new ApiRouteError("Invalid session payload", 400, undefined, {
        workspace_id: "Workspace id must be a string.",
      });
    }

    const id = uuidv4();
    const created_at = new Date().toISOString();

    await db.run(
      "INSERT INTO sessions (id, workspace_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, resolvedWorkspaceId, resolvedTitle, created_at, created_at],
    );

    return NextResponse.json(
      {
        id,
        workspace_id: resolvedWorkspaceId,
        title: resolvedTitle,
        created_at,
        updated_at: created_at,
      } satisfies Session,
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to create session");
  }
}
