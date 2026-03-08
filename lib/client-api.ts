export async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      error?: string;
      details?: string;
    } | T;

    if (!response.ok) {
      const errorPayload = payload as { error?: string; details?: string };
      throw new Error(errorPayload.details || errorPayload.error || response.statusText);
    }

    return payload as T;
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || response.statusText);
  }

  return text as T;
}

export function getClientErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
