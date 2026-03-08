import path from "node:path";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { v4 as uuidv4 } from "uuid";
import {
  getFileNameFromPath,
  inferFileType,
  normalizeStoredPath,
} from "@/lib/virtual-fs";

let dbPromise: Promise<Database> | null = null;

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

export async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: path.resolve(process.cwd(), "workspace.db"),
      driver: sqlite3.Database,
    })
      .then(async (database) => {
        await database.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
      `);
        await initDb(database);
        return database;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

async function initDb(db: Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT
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
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_session_created_at ON messages(session_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_artifacts_session_created_at ON artifacts(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deployments_session_created_at ON deployments(session_id, created_at DESC);
  `);

  await db.exec("DROP INDEX IF EXISTS idx_files_workspace_path");

  const existingFiles = await db.all<
    {
      id: string;
      workspace_id: string;
      path: string;
      name: string | null;
      type: string | null;
      created_at: string | null;
    }[]
  >(
    "SELECT id, workspace_id, path, name, type, created_at FROM files ORDER BY created_at ASC, id ASC",
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

  // Seed default workspace if not exists
  const workspace = await db.get("SELECT * FROM workspaces LIMIT 1");
  if (!workspace) {
    const wsId = uuidv4();
    await db.run(
      "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
      [wsId, "Default Workspace", new Date().toISOString()],
    );

    // Seed some initial files
    const fileId1 = uuidv4();
    await db.run(
      "INSERT INTO files (id, workspace_id, name, path, content, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        fileId1,
        wsId,
        "README.md",
        "README.md",
        "# Welcome to your AI Workspace\n\nThis is a real file stored in the database.",
        "markdown",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const fileId2 = uuidv4();
    await db.run(
      "INSERT INTO files (id, workspace_id, name, path, content, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        fileId2,
        wsId,
        "script.js",
        "script.js",
        'console.log("Hello World");',
        "javascript",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  }
}

export async function getDefaultWorkspaceId() {
  const db = await getDb();
  const workspace = await db.get<{ id: string }>(
    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
  );

  if (!workspace?.id) {
    throw new Error("Workspace not found");
  }

  return workspace.id;
}
