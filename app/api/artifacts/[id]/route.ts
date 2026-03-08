import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api";
import { deleteArtifact } from "@/lib/services/artifacts";

type ArtifactRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, { params }: ArtifactRouteContext) {
  try {
    const { id } = await params;
    await deleteArtifact(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete artifact");
  }
}
