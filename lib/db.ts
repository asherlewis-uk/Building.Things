import path from "node:path";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { initDb } from "@/lib/db-schema";

let dbPromise: Promise<Database> | null = null;

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

export async function getActiveWorkspaceId() {
  const db = await getDb();
  const activeWorkspace = await db.get<{ value: string }>(
    "SELECT value FROM app_state WHERE key = 'active_workspace_id' LIMIT 1",
  );

  if (activeWorkspace?.value) {
    return activeWorkspace.value;
  }

  return getDefaultWorkspaceId();
}

export async function setActiveWorkspaceId(workspaceId: string) {
  const db = await getDb();
  const updatedAt = new Date().toISOString();

  await db.run(
    `INSERT INTO app_state (key, value, updated_at) VALUES ('active_workspace_id', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [workspaceId, updatedAt],
  );
}
