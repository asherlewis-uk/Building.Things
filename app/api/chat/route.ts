import { parseRequestJson, toErrorResponse } from "@/lib/api";
import { buildChatAssistantReply } from "@/lib/services/assistant";
import type { Session } from "@/lib/types";

type ChatRequestBody = {
  messages?: Array<{
    role?: string;
    content?: unknown;
  }>;
  system?: unknown;
};

export async function POST(req: Request) {
  try {
    const parsedBody = await parseRequestJson<ChatRequestBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { messages } = parsedBody.data;

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Invalid messages format" },
        { status: 400 },
      );
    }

    const assistantResponse = await buildChatAssistantReply({
      session: {
        id: "adhoc",
        workspace_id: "adhoc",
        title: "Ad hoc Chat",
        mode: "chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      } satisfies Session,
      messages: messages.map((message): { role: string; content: unknown } => ({
        role: typeof message.role === "string" ? message.role : "user",
        content: message.content ?? "",
      })),
      responseStyle: "balanced",
    });

    return new Response(assistantResponse.stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Stub": "true",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to handle chat request");
  }
}
