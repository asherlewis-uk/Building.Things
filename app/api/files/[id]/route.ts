import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  deleteFile,
  requireFile,
  updateFile as updateFileRecord,
} from "@/lib/services/files";

type FileRouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateFileBody = {
  content?: unknown;
  name?: unknown;
  path?: unknown;
  type?: unknown;
};

export async function GET(_req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    const file = await requireFile(id);

    return NextResponse.json(file);
  } catch (error) {
    return toErrorResponse(error, "Failed to load file");
  }
}

async function handleUpdateFile(req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<UpdateFileBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const file = await updateFileRecord(id, parsedBody.data);

    return NextResponse.json(file);
  } catch (error) {
    return toErrorResponse(error, "Failed to update file");
  }
}

export async function PUT(req: Request, context: FileRouteContext) {
  return handleUpdateFile(req, context);
}

export async function PATCH(req: Request, context: FileRouteContext) {
  return handleUpdateFile(req, context);
}

export async function DELETE(_req: Request, { params }: FileRouteContext) {
  try {
    const { id } = await params;
    await deleteFile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete file");
  }
}
