import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildFilePreview, buildMissingPreview } from "@/lib/preview";
import type { FileRecord } from "@/lib/types";

type PreviewRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: PreviewRouteContext) {
  try {
    const { id } = await params;
    const db = await getDb();
    const file = await db.get<FileRecord>("SELECT * FROM files WHERE id = ?", [
      id,
    ]);

    if (!file) {
      const missingPreview = buildMissingPreview(id);
      return new NextResponse(missingPreview.body, {
        status: missingPreview.status,
        headers: {
          "Content-Type": missingPreview.contentType,
        },
      });
    }

    const preview = buildFilePreview(file);

    return new NextResponse(preview.body, {
      status: preview.status,
      headers: {
        "Content-Type": preview.contentType,
      },
    });
  } catch {
    const fallbackPreview = buildMissingPreview("unknown");
    return new NextResponse(fallbackPreview.body, {
      status: 500,
      headers: {
        "Content-Type": fallbackPreview.contentType,
      },
    });
  }
}
