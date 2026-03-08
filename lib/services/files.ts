import { v4 as uuidv4 } from "uuid";
import { ApiRouteError, trimString } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { FileRecord, FileSummary } from "@/lib/types";
import {
  getFileNameFromPath,
  inferFileType,
  normalizeStoredPath,
} from "@/lib/virtual-fs";
import { requireWorkspace } from "@/lib/services/workspaces";

function validatePath(path: string) {
  if (path.length > 260) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      path: "Path must be 260 characters or fewer.",
    });
  }

  if (!path) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      path: "Path is required.",
    });
  }
}

export async function listFiles(workspaceId: string) {
  const db = await getDb();
  return db.all<FileSummary[]>(
    "SELECT id, workspace_id, name, path, type, created_at, updated_at FROM files WHERE workspace_id = ? ORDER BY path ASC, updated_at DESC",
    [workspaceId],
  );
}

export async function getFileById(fileId: string) {
  const db = await getDb();
  return db.get<FileRecord>("SELECT * FROM files WHERE id = ?", [fileId]);
}

export async function requireFile(fileId: string) {
  const file = await getFileById(fileId);

  if (!file) {
    throw new ApiRouteError("File not found", 404);
  }

  return file;
}

export async function createFile(input: {
  workspace_id: string;
  name?: unknown;
  path?: unknown;
  content?: unknown;
  type?: unknown;
}) {
  const db = await getDb();
  await requireWorkspace(input.workspace_id);
  const requestedPath = trimString(input.path) ?? trimString(input.name);

  if (!requestedPath) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      path: "Path or name is required.",
    });
  }

  const normalizedPath = normalizeStoredPath(requestedPath);
  validatePath(normalizedPath);

  const name = trimString(input.name) ?? getFileNameFromPath(normalizedPath);
  const type = trimString(input.type) ?? inferFileType(normalizedPath);
  const content = typeof input.content === "string" ? input.content : "";
  const duplicate = await db.get<{ id: string }>(
    "SELECT id FROM files WHERE workspace_id = ? AND path = ? LIMIT 1",
    [input.workspace_id, normalizedPath],
  );

  if (duplicate?.id) {
    throw new ApiRouteError("File already exists", 409, undefined, {
      path: "A file with this path already exists.",
    });
  }

  const now = new Date().toISOString();
  const file: FileRecord = {
    id: uuidv4(),
    workspace_id: input.workspace_id,
    name,
    path: normalizedPath,
    type,
    content,
    created_at: now,
    updated_at: now,
  };

  await db.run(
    "INSERT INTO files (id, workspace_id, name, path, content, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      file.id,
      file.workspace_id,
      file.name,
      file.path,
      file.content,
      file.type,
      file.created_at,
      file.updated_at,
    ],
  );
  await db.run("UPDATE workspaces SET updated_at = ? WHERE id = ?", [
    now,
    file.workspace_id,
  ]);

  return file;
}

export async function updateFile(
  fileId: string,
  patch: {
    content?: unknown;
    name?: unknown;
    path?: unknown;
    type?: unknown;
  },
) {
  const db = await getDb();
  const existingFile = await requireFile(fileId);
  const hasPathUpdate = patch.path !== undefined;
  const requestedPath = hasPathUpdate ? trimString(patch.path) : null;

  if (hasPathUpdate && !requestedPath) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      path: "Path must be a non-empty string.",
    });
  }

  const nextPath = hasPathUpdate
    ? normalizeStoredPath(requestedPath)
    : existingFile.path;
  validatePath(nextPath);

  const nextName =
    patch.name !== undefined
      ? trimString(patch.name)
      : hasPathUpdate
        ? getFileNameFromPath(nextPath)
        : existingFile.name;
  const nextType =
    patch.type !== undefined
      ? trimString(patch.type)
      : hasPathUpdate
        ? inferFileType(nextPath)
        : existingFile.type;
  const nextContent =
    patch.content !== undefined
      ? typeof patch.content === "string"
        ? patch.content
        : null
      : existingFile.content;

  if (!nextName) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      name: "Name must be a non-empty string.",
    });
  }

  if (!nextType) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      type: "Type must be a non-empty string.",
    });
  }

  if (nextContent === null) {
    throw new ApiRouteError("Invalid file payload", 400, undefined, {
      content: "Content must be a string.",
    });
  }

  const duplicate = await db.get<{ id: string }>(
    "SELECT id FROM files WHERE workspace_id = ? AND path = ? AND id != ? LIMIT 1",
    [existingFile.workspace_id, nextPath, fileId],
  );

  if (duplicate?.id) {
    throw new ApiRouteError("File already exists", 409, undefined, {
      path: "A file with this path already exists.",
    });
  }

  const updatedAt = new Date().toISOString();
  const file: FileRecord = {
    ...existingFile,
    name: nextName,
    path: nextPath,
    type: nextType,
    content: nextContent,
    updated_at: updatedAt,
  };

  await db.run(
    "UPDATE files SET name = ?, path = ?, type = ?, content = ?, updated_at = ? WHERE id = ?",
    [file.name, file.path, file.type, file.content, file.updated_at, file.id],
  );
  await db.run("UPDATE workspaces SET updated_at = ? WHERE id = ?", [
    updatedAt,
    file.workspace_id,
  ]);

  return file;
}

export async function deleteFile(fileId: string) {
  const db = await getDb();
  const file = await requireFile(fileId);

  await db.run("DELETE FROM files WHERE id = ?", [fileId]);
  await db.run("UPDATE workspaces SET updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    file.workspace_id,
  ]);

  return file;
}
