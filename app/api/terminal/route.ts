import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import { getDb } from "@/lib/db";
import { executeTerminalCommand } from "@/lib/terminal";
import { resolveWorkspaceId } from "@/lib/services/workspaces";
import type { FileRecord } from "@/lib/types";

type TerminalRequestBody = {
  command?: unknown;
  cwd?: unknown;
  sessionId?: unknown;
  workspace_id?: unknown;
};

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<TerminalRequestBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { command, cwd = "/", sessionId } = parsedBody.data;

    if (typeof command !== "string" || !command.trim()) {
      return NextResponse.json(
        {
          error: "Command is required",
          fieldErrors: { command: "Command is required." },
        },
        { status: 400 },
      );
    }

    const workspaceId = await resolveWorkspaceId(parsedBody.data.workspace_id);
    const db = await getDb();
    const files = await db.all<
      Array<Pick<FileRecord, "name" | "path" | "content">>
    >(
      "SELECT name, path, content FROM files WHERE workspace_id = ? ORDER BY path ASC",
      [workspaceId],
    );
    const response = executeTerminalCommand({
      command,
      cwd: typeof cwd === "string" ? cwd : "/",
      sessionKey: typeof sessionId === "string" ? sessionId : undefined,
      files,
    });

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "Failed to execute terminal command");
  }
}
