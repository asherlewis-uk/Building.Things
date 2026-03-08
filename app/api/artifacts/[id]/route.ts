import { NextResponse } from "next/server";
import { ApiRouteError, toErrorResponse } from "@/lib/api";
import { getDb } from "@/lib/db";

type ArtifactRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, { params }: ArtifactRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const artifact = await db.get<{ id: string }>(
      "SELECT id FROM artifacts WHERE id = ?",
      [id],
    );

    if (!artifact?.id) {
      throw new ApiRouteError("Artifact not found", 404);
    }

    await db.run("DELETE FROM artifacts WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete artifact");
  }
}
