import { buildStubAssistantReply, createTextStream } from "@/lib/ai-stub";
import { parseRequestJson, toErrorResponse } from "@/lib/api";

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

    const { messages, system } = parsedBody.data;

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Invalid messages format" },
        { status: 400 },
      );
    }

    const text = buildStubAssistantReply(
      messages.map((message) => ({
        role: typeof message.role === "string" ? message.role : "user",
        content: message.content ?? "",
      })),
      system,
    );

    return new Response(createTextStream(text), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Stub": "true",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to handle chat request");
  }
}
