import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import type { FileRecord } from "@/lib/types";
import {
  getFileNameFromPath,
  inferFileType,
  normalizeStoredPath,
} from "@/lib/virtual-fs";

type FileRouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateFileBody = {
  content?: unknown;
  name?: unknown;
  path?: unknown;
  type?: unknown;
};

export async function GET(_req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const file = await db.get<FileRecord>("SELECT * FROM files WHERE id = ?", [
      id,
    ]);

    if (!file) {
      throw new ApiRouteError("File not found", 404);
    }

    return NextResponse.json(file);
  } catch (error) {
    return toErrorResponse(error, "Failed to load file");
  }
}

async function updateFile(req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<UpdateFileBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const db = await getDb();
    const existingFile = await db.get<FileRecord>(
      "SELECT * FROM files WHERE id = ?",
      [id],
    );

    if (!existingFile) {
      throw new ApiRouteError("File not found", 404);
    }

    const { content, name, path, type } = parsedBody.data;
    const hasPathUpdate = path !== undefined;
    const pathValue = hasPathUpdate ? trimString(path) : null;

    if (hasPathUpdate && !pathValue) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        path: "Path must be a non-empty string.",
      });
    }

    const normalizedPath = hasPathUpdate
      ? normalizeStoredPath(pathValue)
      : existingFile.path;
    const resolvedName =
      name !== undefined
        ? trimString(name)
        : hasPathUpdate
          ? getFileNameFromPath(normalizedPath)
          : existingFile.name;

    if (!resolvedName) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        name: "Name must be a non-empty string.",
      });
    }

    const resolvedType =
      type !== undefined
        ? trimString(type)
        : hasPathUpdate
          ? inferFileType(normalizedPath)
          : existingFile.type;

    if (!resolvedType) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        type: "Type must be a non-empty string.",
      });
    }

    const resolvedContent =
      content !== undefined
        ? typeof content === "string"
          ? content
          : null
        : existingFile.content;

    if (resolvedContent === null) {
      throw new ApiRouteError("Invalid file payload", 400, undefined, {
        content: "Content must be a string.",
      });
    }

    const duplicateFile = await db.get<{ id: string }>(
      "SELECT id FROM files WHERE workspace_id = ? AND path = ? AND id != ?",
      [existingFile.workspace_id, normalizedPath, id],
    );

    if (duplicateFile?.id) {
      throw new ApiRouteError("File already exists", 409, undefined, {
        path: "A file with this path already exists.",
      });
    }

    const now = new Date().toISOString();

    await db.run(
      "UPDATE files SET name = ?, path = ?, type = ?, content = ?, updated_at = ? WHERE id = ?",
      [resolvedName, normalizedPath, resolvedType, resolvedContent, now, id],
    );

    return NextResponse.json({
      id,
      workspace_id: existingFile.workspace_id,
      name: resolvedName,
      path: normalizedPath,
      type: resolvedType,
      content: resolvedContent,
      created_at: existingFile.created_at,
      updated_at: now,
    } satisfies FileRecord);
  } catch (error) {
    return toErrorResponse(error, "Failed to update file");
  }
}

export async function PUT(req: Request, context: FileRouteContext) {
  return updateFile(req, context);
}

export async function PATCH(req: Request, context: FileRouteContext) {
  return updateFile(req, context);
}

export async function DELETE(_req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const file = await db.get<{ id: string }>(
      "SELECT id FROM files WHERE id = ?",
      [id],
    );

    if (!file?.id) {
      throw new ApiRouteError("File not found", 404);
    }

    await db.run("DELETE FROM files WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete file");
  }
}
