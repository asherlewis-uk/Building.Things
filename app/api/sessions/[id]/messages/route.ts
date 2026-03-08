import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { getResolvedConfig } from "@/lib/services/config";
import { requireFile } from "@/lib/services/files";
import {
  buildChatAssistantReply,
  executeWriteAssistant,
} from "@/lib/services/assistant";
import { requireSession } from "@/lib/services/workspaces";
import type { Message, MessageRole, SessionMode } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateMessageBody = {
  content?: unknown;
  role?: unknown;
  mode?: unknown;
  current_file_id?: unknown;
};

function normalizeMessageRole(role: unknown): MessageRole {
  return role === "assistant" || role === "system" ? role : "user";
}

function normalizeStoredMessage(
  message: Partial<Message>,
  sessionId: string,
  fallbackId: string,
  defaultMode: SessionMode,
): Message {
  return {
    id:
      typeof message.id === "string" && message.id.trim()
        ? message.id
        : fallbackId,
    session_id:
      typeof message.session_id === "string" && message.session_id.trim()
        ? message.session_id
        : sessionId,
    role: normalizeMessageRole(message.role),
    content: typeof message.content === "string" ? message.content : "",
    mode:
      message.mode === "write" || message.mode === "chat"
        ? message.mode
        : defaultMode,
    metadata_json:
      typeof message.metadata_json === "string" ? message.metadata_json : null,
    created_at:
      typeof message.created_at === "string" && message.created_at.trim()
        ? message.created_at
        : new Date().toISOString(),
  };
}

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const session = await requireSession(id);

    const messages = await db.all<Array<Partial<Message>>>(
      "SELECT id, session_id, role, content, mode, metadata_json, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [id],
    );

    return NextResponse.json(
      messages.map((message, index) =>
        normalizeStoredMessage(message, id, `message-${index}`, session.mode),
      ),
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load messages");
  }
}

export async function POST(req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<CreateMessageBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { content, role, mode } = parsedBody.data;
    const db = await getDb();
    const session = await requireSession(id);
    const sessionMode: SessionMode =
      mode === "write" || mode === "chat" ? mode : session.mode;

    const normalizedContent = trimString(content);

    if (!normalizedContent) {
      throw new ApiRouteError("Invalid message payload", 400, undefined, {
        content: "Message content is required.",
      });
    }

    if (normalizedContent.length > 20000) {
      throw new ApiRouteError("Invalid message payload", 400, undefined, {
        content: "Message content must be 20000 characters or fewer.",
      });
    }

    const normalizedRole = normalizeMessageRole(role);
    const msgId = uuidv4();
    const created_at = new Date().toISOString();

    await db.run(
      "INSERT INTO messages (id, session_id, role, content, mode, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        msgId,
        id,
        normalizedRole,
        normalizedContent,
        sessionMode,
        null,
        created_at,
      ],
    );
    await db.run("UPDATE sessions SET mode = ?, updated_at = ? WHERE id = ?", [
      sessionMode,
      created_at,
      id,
    ]);

    if (normalizedRole !== "user") {
      return NextResponse.json(
        {
          id: msgId,
          session_id: id,
          role: normalizedRole,
          content: normalizedContent,
          mode: sessionMode,
          metadata_json: null,
          created_at,
        } satisfies Message,
        { status: 201 },
      );
    }

    const history = await db.all<Array<Pick<Message, "role" | "content">>>(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [id],
    );
    const config = await getResolvedConfig(session.workspace_id);
    const requestedCurrentFileId =
      typeof parsedBody.data.current_file_id === "string"
        ? parsedBody.data.current_file_id
        : null;
    const currentFile = requestedCurrentFileId
      ? await requireFile(requestedCurrentFileId)
      : null;

    if (currentFile && currentFile.workspace_id !== session.workspace_id) {
      throw new ApiRouteError("Invalid message payload", 400, undefined, {
        current_file_id:
          "Selected file does not belong to the current workspace.",
      });
    }

    const assistantResponse =
      sessionMode === "write"
        ? await executeWriteAssistant({
            messages: history,
            session: {
              ...session,
              mode: sessionMode,
              updated_at: created_at,
            },
            currentFile,
            workspaceId: session.workspace_id,
            responseStyle: config.effective.assistant_response_style,
            autoArtifactSnapshots: config.effective.auto_artifact_snapshots,
          })
        : await buildChatAssistantReply({
            messages: history,
            session: {
              ...session,
              mode: sessionMode,
              updated_at: created_at,
            },
            responseStyle: config.effective.assistant_response_style,
          });
    const customStream = assistantResponse.stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        async flush() {
          const aiId = uuidv4();
          const aiCreatedAt = new Date().toISOString();
          await db.run(
            "INSERT INTO messages (id, session_id, role, content, mode, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              aiId,
              id,
              "assistant",
              assistantResponse.content,
              sessionMode,
              JSON.stringify(assistantResponse.metadata),
              aiCreatedAt,
            ],
          );
          await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
            aiCreatedAt,
            id,
          ]);
        },
      }),
    );

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Stub": "true",
        "X-Session-Mode": sessionMode,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create message");
  }
}
