import { v4 as uuidv4 } from "uuid";
import { ApiRouteError, trimString } from "@/lib/api";
import {
  getActiveWorkspaceId,
  getDb,
  getDefaultWorkspaceId,
  setActiveWorkspaceId,
} from "@/lib/db";
import {
  getResolvedConfig,
  parseWorkspaceSettings,
} from "@/lib/services/config";
import type { Session, SessionMode, Workspace } from "@/lib/types";

export async function listWorkspaces() {
  const db = await getDb();
  return db.all<Workspace[]>(
    "SELECT id, name, created_at, updated_at, settings_json FROM workspaces ORDER BY updated_at DESC, created_at ASC",
  );
}

export async function getWorkspaceById(workspaceId: string) {
  const db = await getDb();
  return db.get<Workspace>(
    "SELECT id, name, created_at, updated_at, settings_json FROM workspaces WHERE id = ?",
    [workspaceId],
  );
}

export async function requireWorkspace(workspaceId: string) {
  const workspace = await getWorkspaceById(workspaceId);

  if (!workspace) {
    throw new ApiRouteError("Workspace not found", 404);
  }

  return workspace;
}

export async function resolveWorkspaceId(candidate?: unknown) {
  if (candidate === "default") {
    return getDefaultWorkspaceId();
  }

  if (
    typeof candidate === "string" &&
    candidate.trim() &&
    candidate !== "active"
  ) {
    const workspace = await getWorkspaceById(candidate);

    if (!workspace) {
      throw new ApiRouteError("Workspace not found", 404);
    }

    return workspace.id;
  }

  return getActiveWorkspaceId();
}

export async function createWorkspace(input: { name?: unknown }) {
  const db = await getDb();
  const existingCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM workspaces",
  );
  const resolvedName =
    trimString(input.name) ?? `Workspace ${(existingCount?.count ?? 0) + 1}`;

  if (resolvedName.length > 80) {
    throw new ApiRouteError("Invalid workspace payload", 400, undefined, {
      name: "Workspace name must be 80 characters or fewer.",
    });
  }

  const now = new Date().toISOString();
  const workspace: Workspace = {
    id: uuidv4(),
    name: resolvedName,
    created_at: now,
    updated_at: now,
    settings_json: JSON.stringify(parseWorkspaceSettings(null)),
  };

  await db.run(
    "INSERT INTO workspaces (id, name, created_at, updated_at, settings_json) VALUES (?, ?, ?, ?, ?)",
    [
      workspace.id,
      workspace.name,
      workspace.created_at,
      workspace.updated_at,
      workspace.settings_json,
    ],
  );

  await setActiveWorkspaceId(workspace.id);
  return workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  patch: { name?: unknown },
) {
  const db = await getDb();
  const workspace = await requireWorkspace(workspaceId);
  const nextName = trimString(patch.name) ?? workspace.name;

  if (nextName.length > 80) {
    throw new ApiRouteError("Invalid workspace payload", 400, undefined, {
      name: "Workspace name must be 80 characters or fewer.",
    });
  }

  const updatedAt = new Date().toISOString();
  await db.run("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?", [
    nextName,
    updatedAt,
    workspaceId,
  ]);

  return {
    ...workspace,
    name: nextName,
    updated_at: updatedAt,
  } satisfies Workspace;
}

export async function deleteWorkspace(workspaceId: string) {
  const db = await getDb();
  const workspace = await requireWorkspace(workspaceId);
  const workspaceCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM workspaces",
  );

  if ((workspaceCount?.count ?? 0) <= 1) {
    throw new ApiRouteError(
      "Cannot delete the only workspace",
      400,
      "Create another workspace before deleting this one.",
    );
  }

  await db.exec("BEGIN TRANSACTION");

  try {
    await db.run(
      "DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?)",
      [workspaceId],
    );
    await db.run(
      "DELETE FROM artifacts WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?)",
      [workspaceId],
    );
    await db.run(
      "DELETE FROM deployments WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?)",
      [workspaceId],
    );
    await db.run("DELETE FROM sessions WHERE workspace_id = ?", [workspaceId]);
    await db.run("DELETE FROM files WHERE workspace_id = ?", [workspaceId]);
    await db.run("DELETE FROM mcp_servers WHERE workspace_id = ?", [
      workspaceId,
    ]);
    await db.run("DELETE FROM workspaces WHERE id = ?", [workspaceId]);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK").catch(() => undefined);
    throw error;
  }

  const nextWorkspaceId = await getDefaultWorkspaceId();
  await setActiveWorkspaceId(nextWorkspaceId);

  return workspace;
}

export async function getActiveWorkspace() {
  const activeWorkspaceId = await getActiveWorkspaceId();
  const workspace = await getWorkspaceById(activeWorkspaceId);

  if (workspace) {
    return workspace;
  }

  const fallbackWorkspaceId = await getDefaultWorkspaceId();
  await setActiveWorkspaceId(fallbackWorkspaceId);
  return requireWorkspace(fallbackWorkspaceId);
}

export async function updateActiveWorkspace(workspaceId: string) {
  await requireWorkspace(workspaceId);
  await setActiveWorkspaceId(workspaceId);
  return requireWorkspace(workspaceId);
}

export async function listSessions(
  workspaceId: string,
  options?: { includeArchived?: boolean },
) {
  const db = await getDb();
  const whereClause = options?.includeArchived
    ? "workspace_id = ?"
    : "workspace_id = ? AND archived_at IS NULL";

  return db.all<Session[]>(
    `SELECT id, workspace_id, title, mode, created_at, updated_at, archived_at FROM sessions WHERE ${whereClause} ORDER BY updated_at DESC, created_at DESC`,
    [workspaceId],
  );
}

export async function getSessionById(sessionId: string) {
  const db = await getDb();
  return db.get<Session>(
    "SELECT id, workspace_id, title, mode, created_at, updated_at, archived_at FROM sessions WHERE id = ?",
    [sessionId],
  );
}

export async function requireSession(sessionId: string) {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new ApiRouteError("Session not found", 404);
  }

  return session;
}

export async function createSession(input: {
  workspace_id?: unknown;
  title?: unknown;
  mode?: unknown;
}) {
  const db = await getDb();
  const workspaceId = await resolveWorkspaceId(input.workspace_id);
  const config = await getResolvedConfig(workspaceId);
  const title = trimString(input.title) ?? "New Session";
  const mode: SessionMode =
    input.mode === "chat" || input.mode === "write"
      ? input.mode
      : config.effective.default_mode;

  if (title.length > 120) {
    throw new ApiRouteError("Invalid session payload", 400, undefined, {
      title: "Title must be 120 characters or fewer.",
    });
  }

  const now = new Date().toISOString();
  const session: Session = {
    id: uuidv4(),
    workspace_id: workspaceId,
    title,
    mode,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };

  await db.run(
    "INSERT INTO sessions (id, workspace_id, title, mode, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      session.id,
      session.workspace_id,
      session.title,
      session.mode,
      session.created_at,
      session.updated_at,
      session.archived_at,
    ],
  );

  await db.run("UPDATE workspaces SET updated_at = ? WHERE id = ?", [
    now,
    workspaceId,
  ]);

  return session;
}

export async function updateSession(
  sessionId: string,
  patch: {
    title?: unknown;
    mode?: unknown;
    archived?: unknown;
    restore?: unknown;
  },
) {
  const db = await getDb();
  const session = await requireSession(sessionId);
  const nextTitle = trimString(patch.title) ?? session.title;
  const nextMode: SessionMode =
    patch.mode === "chat" || patch.mode === "write" ? patch.mode : session.mode;
  const shouldArchive = Boolean(patch.archived);
  const shouldRestore = Boolean(patch.restore);
  const archivedAt = shouldRestore
    ? null
    : shouldArchive
      ? new Date().toISOString()
      : session.archived_at;
  const updatedAt = new Date().toISOString();

  if (nextTitle.length > 120) {
    throw new ApiRouteError("Invalid session payload", 400, undefined, {
      title: "Title must be 120 characters or fewer.",
    });
  }

  await db.run(
    "UPDATE sessions SET title = ?, mode = ?, archived_at = ?, updated_at = ? WHERE id = ?",
    [nextTitle, nextMode, archivedAt, updatedAt, sessionId],
  );

  return {
    ...session,
    title: nextTitle,
    mode: nextMode,
    archived_at: archivedAt,
    updated_at: updatedAt,
  } satisfies Session;
}

export async function deleteSession(sessionId: string) {
  const db = await getDb();
  const session = await requireSession(sessionId);

  await db.exec("BEGIN TRANSACTION");

  try {
    await db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);
    await db.run("DELETE FROM artifacts WHERE session_id = ?", [sessionId]);
    await db.run("DELETE FROM deployments WHERE session_id = ?", [sessionId]);
    await db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK").catch(() => undefined);
    throw error;
  }

  return session;
}
