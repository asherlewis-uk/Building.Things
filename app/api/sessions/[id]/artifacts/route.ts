import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Artifact } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateArtifactBody = {
  title?: unknown;
  type?: unknown;
  content?: unknown;
};

async function assertSessionExists(sessionId: string) {
  const db = await getDb();
  const session = await db.get<{ id: string }>(
    "SELECT id FROM sessions WHERE id = ?",
    [sessionId],
  );

  if (!session?.id) {
    throw new ApiRouteError("Session not found", 404);
  }

  return db;
}

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const db = await assertSessionExists(id);
    const artifacts = await db.all<Artifact[]>(
      "SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at DESC",
      [id],
    );
    return NextResponse.json(artifacts);
  } catch (error) {
    return toErrorResponse(error, "Failed to load artifacts");
  }
}

export async function POST(req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<CreateArtifactBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const db = await assertSessionExists(id);
    const { title, type, content } = parsedBody.data;
    const resolvedTitle = trimString(title) ?? "Untitled Artifact";
    const resolvedType = trimString(type) ?? "snapshot";
    const resolvedContent =
      typeof content === "string"
        ? content
        : JSON.stringify(content ?? "", null, 2);

    if (resolvedTitle.length > 120) {
      throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
        title: "Title must be 120 characters or fewer.",
      });
    }

    if (resolvedType.length > 60) {
      throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
        type: "Type must be 60 characters or fewer.",
      });
    }

    if (resolvedContent.length > 100000) {
      throw new ApiRouteError("Invalid artifact payload", 400, undefined, {
        content: "Artifact content must be 100000 characters or fewer.",
      });
    }

    const artifact: Artifact = {
      id: uuidv4(),
      session_id: id,
      title: resolvedTitle,
      type: resolvedType,
      content: resolvedContent,
      created_at: new Date().toISOString(),
    };

    await db.run(
      "INSERT INTO artifacts (id, session_id, title, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        artifact.id,
        artifact.session_id,
        artifact.title,
        artifact.type,
        artifact.content,
        artifact.created_at,
      ],
    );
    await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
      artifact.created_at,
      id,
    ]);

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create artifact");
  }
}
