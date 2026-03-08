import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import { createArtifact, listArtifacts } from "@/lib/services/artifacts";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateArtifactBody = {
  title?: unknown;
  type?: unknown;
  content?: unknown;
  metadata_json?: unknown;
};

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const artifacts = await listArtifacts(id);
    return NextResponse.json(artifacts);
  } catch (error) {
    return toErrorResponse(error, "Failed to load artifacts");
  }
}

export async function POST(req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<CreateArtifactBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const artifact = await createArtifact({
      session_id: id,
      title: parsedBody.data.title,
      type: parsedBody.data.type,
      content: parsedBody.data.content,
      metadata_json:
        typeof parsedBody.data.metadata_json === "string"
          ? parsedBody.data.metadata_json
          : null,
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create artifact");
  }
}
