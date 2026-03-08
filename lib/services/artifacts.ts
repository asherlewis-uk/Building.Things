import { v4 as uuidv4 } from "uuid";
import { ApiRouteError, trimString } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Artifact } from "@/lib/types";
import { requireSession } from "@/lib/services/workspaces";

export async function listArtifacts(sessionId: string) {
  const db = await getDb();
  await requireSession(sessionId);
  return db.all<Artifact[]>(
    "SELECT id, session_id, title, type, content, metadata_json, created_at FROM artifacts WHERE session_id = ? ORDER BY created_at DESC",
    [sessionId],
  );
}

export async function createArtifact(input: {
  session_id: string;
  title?: unknown;
  type?: unknown;
  content?: unknown;
  metadata_json?: string | null;
}) {
  const db = await getDb();
  const session = await requireSession(input.session_id);
  const title = trimString(input.title) ?? "Untitled Artifact";
  const type = trimString(input.type) ?? "snapshot";
  const content =
    typeof input.content === "string"
      ? input.content
      : JSON.stringify(input.content ?? "", null, 2);

  if (title.length > 120) {
    throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
      title: "Title must be 120 characters or fewer.",
    });
  }

  if (type.length > 60) {
    throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
      type: "Type must be 60 characters or fewer.",
    });
  }

  if (content.length > 100000) {
    throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
      content: "Artifact content must be 100000 characters or fewer.",
    });
  }

  const artifact: Artifact = {
    id: uuidv4(),
    session_id: session.id,
    title,
    type,
    content,
    metadata_json: input.metadata_json ?? null,
    created_at: new Date().toISOString(),
  };

  await db.run(
    "INSERT INTO artifacts (id, session_id, title, type, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      artifact.id,
      artifact.session_id,
      artifact.title,
      artifact.type,
      artifact.content,
      artifact.metadata_json,
      artifact.created_at,
    ],
  );
  await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
    artifact.created_at,
    session.id,
  ]);

  return artifact;
}

export async function deleteArtifact(artifactId: string) {
  const db = await getDb();
  const artifact = await db.get<Artifact>(
    "SELECT id, session_id, title, type, content, metadata_json, created_at FROM artifacts WHERE id = ?",
    [artifactId],
  );

  if (!artifact) {
    throw new ApiRouteError("Artifact not found", 404);
  }

  await db.run("DELETE FROM artifacts WHERE id = ?", [artifactId]);
  return artifact;
}
