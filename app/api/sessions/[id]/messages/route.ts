import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { buildStubAssistantReply, createTextStream } from "@/lib/ai-stub";
import type { Message, MessageRole } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateMessageBody = {
  content?: unknown;
  role?: unknown;
};

function normalizeMessageRole(role: unknown): MessageRole {
  return role === "assistant" || role === "system" ? role : "user";
}

function normalizeStoredMessage(
  message: Partial<Message>,
  sessionId: string,
  fallbackId: string,
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
    const session = await db.get<{ id: string }>(
      "SELECT id FROM sessions WHERE id = ?",
      [id],
    );

    if (!session?.id) {
      throw new ApiRouteError("Session not found", 404);
    }

    const messages = await db.all<Array<Partial<Message>>>(
      "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [id],
    );

    return NextResponse.json(
      messages.map((message, index) =>
        normalizeStoredMessage(message, id, `message-${index}`),
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

    const { content, role } = parsedBody.data;
    const db = await getDb();
    const session = await db.get<{ id: string }>(
      "SELECT id FROM sessions WHERE id = ?",
      [id],
    );

    if (!session?.id) {
      throw new ApiRouteError("Session not found", 404);
    }

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
      "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
      [msgId, id, normalizedRole, normalizedContent, created_at],
    );
    await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
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
          created_at,
        } satisfies Message,
        { status: 201 },
      );
    }

    const history = await db.all<Array<Pick<Message, "role" | "content">>>(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [id],
    );
    const aiContent = buildStubAssistantReply(history);
    const customStream = createTextStream(aiContent, {
      onComplete: async () => {
        const aiId = uuidv4();
        const aiCreatedAt = new Date().toISOString();
        await db.run(
          "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
          [aiId, id, "assistant", aiContent, aiCreatedAt],
        );
        await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
          aiCreatedAt,
          id,
        ]);
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Stub": "true",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create message");
  }
}
