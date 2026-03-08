import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  error: string;
  details?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiRouteError extends Error {
  status: number;
  details?: string;
  fieldErrors?: Record<string, string>;

  constructor(
    error: string,
    status = 400,
    details?: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(error);
    this.name = "ApiRouteError";
    this.status = status;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

export async function parseRequestJson<T>(
  request: Request,
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse<ApiErrorPayload> }
> {
  try {
    const data = (await request.json()) as T;
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: jsonError("Invalid JSON body", 400),
    };
  }
}

export function jsonError(
  error: string,
  status = 400,
  details?: string,
  fieldErrors?: Record<string, string>,
) {
  const payload: ApiErrorPayload = { error };

  if (details) {
    payload.details = details;
  }

  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    payload.fieldErrors = fieldErrors;
  }

  return NextResponse.json(payload, { status });
}

export function trimString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function toErrorResponse(
  error: unknown,
  fallbackError: string,
  fallbackStatus = 500,
) {
  if (error instanceof ApiRouteError) {
    return jsonError(
      error.message,
      error.status,
      error.details,
      error.fieldErrors,
    );
  }

  return jsonError(
    fallbackError,
    fallbackStatus,
    getErrorMessage(error, fallbackError),
  );
}
