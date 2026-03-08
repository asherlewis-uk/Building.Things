import { NextResponse } from "next/server";
import { ApiRouteError, toErrorResponse } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Session } from "@/lib/types";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const session = await db.get<Session>(
      "SELECT * FROM sessions WHERE id = ?",
      [id],
    );

    if (!session) {
      throw new ApiRouteError("Session not found", 404);
    }

    return NextResponse.json(session);
  } catch (error) {
    return toErrorResponse(error, "Failed to load session");
  }
}

export async function DELETE(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const session = await db.get<{ id: string }>(
      "SELECT id FROM sessions WHERE id = ?",
      [id],
    );

    if (!session?.id) {
      throw new ApiRouteError("Session not found", 404);
    }

    await db.exec("BEGIN TRANSACTION");
    await db.run("DELETE FROM messages WHERE session_id = ?", [id]);
    await db.run("DELETE FROM artifacts WHERE session_id = ?", [id]);
    await db.run("DELETE FROM deployments WHERE session_id = ?", [id]);
    await db.run("DELETE FROM sessions WHERE id = ?", [id]);
    await db.exec("COMMIT");

    return NextResponse.json({ success: true });
  } catch (error) {
    const db = await getDb();
    await db.exec("ROLLBACK").catch(() => undefined);
    return toErrorResponse(error, "Failed to delete session");
  }
}
