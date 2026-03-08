import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb, getDefaultWorkspaceId } from "@/lib/db";
import type { FileSummary } from "@/lib/types";
import {
  getFileNameFromPath,
  inferFileType,
  normalizeStoredPath,
} from "@/lib/virtual-fs";
import { v4 as uuidv4 } from "uuid";

type CreateFileBody = {
  workspace_id?: unknown;
  name?: unknown;
  path?: unknown;
  content?: unknown;
  type?: unknown;
};

export async function GET() {
  try {
    const db = await getDb();
    const files = await db.all<FileSummary[]>(
      "SELECT id, workspace_id, name, path, type, created_at, updated_at FROM files ORDER BY path ASC, updated_at DESC",
    );
    return NextResponse.json(files);
  } catch (error) {
    return toErrorResponse(error, "Failed to load files");
  }
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<CreateFileBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { workspace_id, name, path, content, type } = parsedBody.data;
    const db = await getDb();

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
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        workspace_id: "Workspace id must be a string.",
      });
    }

    const requestedPath = trimString(path) ?? trimString(name);

    if (!requestedPath) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        path: "Path or name is required.",
      });
    }

    const normalizedPath = normalizeStoredPath(requestedPath);
    const resolvedName =
      trimString(name) ?? getFileNameFromPath(normalizedPath);
    const resolvedType = trimString(type) ?? inferFileType(normalizedPath);
    const resolvedContent = typeof content === "string" ? content : "";

    if (normalizedPath.length > 260) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        path: "Path must be 260 characters or fewer.",
      });
    }

    const duplicateFile = await db.get<{ id: string }>(
      "SELECT id FROM files WHERE workspace_id = ? AND path = ?",
      [resolvedWorkspaceId, normalizedPath],
    );

    if (duplicateFile?.id) {
      throw new ApiRouteError("File already exists", 409, undefined, {
        path: "A file with this path already exists.",
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      "INSERT INTO files (id, workspace_id, name, path, content, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        resolvedWorkspaceId,
        resolvedName,
        normalizedPath,
        resolvedContent,
        resolvedType,
        now,
        now,
      ],
    );

    return NextResponse.json(
      {
        id,
        workspace_id: resolvedWorkspaceId,
        name: resolvedName,
        path: normalizedPath,
        type: resolvedType,
        created_at: now,
        updated_at: now,
      } satisfies FileSummary,
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to create file");
  }
}
