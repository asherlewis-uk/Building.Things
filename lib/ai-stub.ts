type StubMessage = {
  role: string;
  content: unknown;
};

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (!part || typeof part !== 'object') {
          return '';
        }

        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }

        if ('content' in part) {
          return stringifyContent(part.content);
        }

        return JSON.stringify(part, null, 2);
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object') {
    if ('text' in content && typeof content.text === 'string') {
      return content.text;
    }

    if ('content' in content) {
      return stringifyContent(content.content);
    }

    return JSON.stringify(content, null, 2);
  }

  return '';
}

function chunkText(text: string, chunkSize: number): string[] {
  if (!text) {
    return [];
  }

  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

export function buildStubAssistantReply(messages: StubMessage[], system?: unknown): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const prompt = stringifyContent(lastUserMessage?.content).trim();
  const systemText = stringifyContent(system).trim();
  const sections = [
    'AI responses are stubbed in this local build.',
    'No Anthropic or Gemini API request was made.',
  ];

  if (prompt) {
    sections.push(`Last prompt:\n${prompt}`);
  } else {
    sections.push('Send a prompt to exercise the shell without any external model calls.');
  }

  if (systemText) {
    sections.push(`System context:\n${systemText}`);
  }

  sections.push('The IDE shell, routing, persistence, and panel rendering remain available for local testing.');

  return sections.join('\n\n');
}

export function createTextStream(
  text: string,
  options?: {
    chunkSize?: number;
    onComplete?: () => Promise<void> | void;
  },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = options?.chunkSize ?? 48;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const chunk of chunkText(text, chunkSize)) {
          controller.enqueue(encoder.encode(chunk));
          await Promise.resolve();
        }

        await options?.onComplete?.();
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
