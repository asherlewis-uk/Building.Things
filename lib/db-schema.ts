import type { Database } from "sqlite";
import { v4 as uuidv4 } from "uuid";
import {
  getFileNameFromPath,
  inferFileType,
  normalizeStoredPath,
} from "@/lib/virtual-fs";

interface TableInfoRow {
  name: string;
}

function splitPathExtension(pathValue: string) {
  const lastSlashIndex = pathValue.lastIndexOf("/");
  const fileName =
    lastSlashIndex >= 0 ? pathValue.slice(lastSlashIndex + 1) : pathValue;
  const fileExtensionIndex = fileName.lastIndexOf(".");

  if (fileExtensionIndex <= 0) {
    return {
      basePath: pathValue,
      extension: "",
    };
  }

  const extension = fileName.slice(fileExtensionIndex);
  return {
    basePath: pathValue.slice(0, pathValue.length - extension.length),
    extension,
  };
}

function buildUniqueStoredPath(
  existingPaths: Set<string>,
  desiredPath: string,
) {
  const normalizedDesiredPath =
    normalizeStoredPath(desiredPath) || "untitled.txt";

  if (!existingPaths.has(normalizedDesiredPath)) {
    return normalizedDesiredPath;
  }

  const { basePath, extension } = splitPathExtension(normalizedDesiredPath);
  let suffix = 2;
  let nextCandidate = `${basePath} (${suffix})${extension}`;

  while (existingPaths.has(nextCandidate)) {
    suffix += 1;
    nextCandidate = `${basePath} (${suffix})${extension}`;
  }

  return nextCandidate;
}

async function ensureColumn(
  db: Database,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = await db.all<TableInfoRow[]>(
    `PRAGMA table_info(${tableName})`,
  );
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
    );
  }
}

async function normalizeExistingFiles(db: Database) {
  await db.exec("DROP INDEX IF EXISTS idx_files_workspace_path");

  const existingFiles = await db.all<
    {
      id: string;
      workspace_id: string;
      path: string;
      name: string | null;
      type: string | null;
    }[]
  >(
    "SELECT id, workspace_id, path, name, type FROM files ORDER BY created_at ASC, id ASC",
  );
  const seenPathsByWorkspace = new Map<string, Set<string>>();

  for (const file of existingFiles) {
    const workspacePaths =
      seenPathsByWorkspace.get(file.workspace_id) ?? new Set<string>();
    const desiredPath =
      normalizeStoredPath(file.path) || `untitled-${file.id.slice(0, 8)}.txt`;
    const normalizedPath = buildUniqueStoredPath(workspacePaths, desiredPath);
    const normalizedName =
      file.name?.trim() || getFileNameFromPath(normalizedPath);
    const normalizedType = file.type?.trim() || inferFileType(normalizedPath);

    workspacePaths.add(normalizedPath);
    seenPathsByWorkspace.set(file.workspace_id, workspacePaths);

    if (
      normalizedPath !== file.path ||
      normalizedName !== file.name ||
      normalizedType !== file.type
    ) {
      await db.run(
        "UPDATE files SET path = ?, name = ?, type = ? WHERE id = ?",
        [normalizedPath, normalizedName, normalizedType, file.id],
      );
    }
  }

  await db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_files_workspace_path ON files(workspace_id, path)",
  );
}

async function ensureAppStateValue(
  db: Database,
  key: string,
  value: string,
  updatedAt: string,
) {
  const existing = await db.get<{ key: string }>(
    "SELECT key FROM app_state WHERE key = ?",
    [key],
  );

  if (!existing?.key) {
    await db.run(
      "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)",
      [key, value, updatedAt],
    );
  }
}

export async function initDb(db: Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      status TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      transport_type TEXT NOT NULL,
      endpoint TEXT,
      command TEXT,
      auth_mode TEXT NOT NULL,
      auth_config_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'unconfigured',
      tool_count INTEGER NOT NULL DEFAULT 0,
      declared_tools_json TEXT,
      last_checked_at TEXT,
      last_error TEXT,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_workspace_updated_at ON sessions(workspace_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_session_created_at ON messages(session_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_artifacts_session_created_at ON artifacts(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deployments_session_created_at ON deployments(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_workspace_name ON mcp_servers(workspace_id, name ASC);
  `);

  await ensureColumn(db, "workspaces", "updated_at", "TEXT");
  await ensureColumn(db, "workspaces", "settings_json", "TEXT");
  await ensureColumn(db, "sessions", "mode", "TEXT NOT NULL DEFAULT 'chat'");
  await ensureColumn(db, "sessions", "archived_at", "TEXT");
  await ensureColumn(db, "messages", "mode", "TEXT NOT NULL DEFAULT 'chat'");
  await ensureColumn(db, "messages", "metadata_json", "TEXT");
  await ensureColumn(db, "artifacts", "metadata_json", "TEXT");
  await ensureColumn(db, "deployments", "updated_at", "TEXT");
  await ensureColumn(db, "deployments", "summary", "TEXT");
  await ensureColumn(db, "deployments", "logs_json", "TEXT");
  await ensureColumn(
    db,
    "mcp_servers",
    "auth_config_json",
    "TEXT NOT NULL DEFAULT '{}'",
  );
  await ensureColumn(
    db,
    "mcp_servers",
    "warnings_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );

  const now = new Date().toISOString();

  await db.run(
    "UPDATE workspaces SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
    [now],
  );
  await db.run(
    "UPDATE workspaces SET settings_json = COALESCE(settings_json, '{}') WHERE settings_json IS NULL OR TRIM(settings_json) = ''",
  );
  await db.run(
    "UPDATE sessions SET mode = 'chat' WHERE mode IS NULL OR TRIM(mode) = ''",
  );
  await db.run(
    "UPDATE messages SET mode = 'chat' WHERE mode IS NULL OR TRIM(mode) = ''",
  );
  await db.run(
    "UPDATE deployments SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
    [now],
  );
  await db.run(
    "UPDATE deployments SET logs_json = COALESCE(logs_json, '[]') WHERE logs_json IS NULL OR TRIM(logs_json) = ''",
  );
  await db.run(
    "UPDATE mcp_servers SET auth_config_json = COALESCE(auth_config_json, '{}') WHERE auth_config_json IS NULL OR TRIM(auth_config_json) = ''",
  );
  await db.run(
    "UPDATE mcp_servers SET warnings_json = COALESCE(warnings_json, '[]') WHERE warnings_json IS NULL OR TRIM(warnings_json) = ''",
  );

  await normalizeExistingFiles(db);

  const workspace = await db.get<{ id: string }>(
    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
  );

  let workspaceId = workspace?.id ?? null;

  if (!workspaceId) {
    workspaceId = uuidv4();
    await db.run(
      "INSERT INTO workspaces (id, name, created_at, updated_at, settings_json) VALUES (?, ?, ?, ?, ?)",
      [workspaceId, "Workspace 1", now, now, "{}"],
    );
  }

  await ensureAppStateValue(db, "active_workspace_id", workspaceId, now);
  await ensureAppStateValue(db, "app_settings_json", "{}", now);
}
