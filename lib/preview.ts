import type { FileRecord } from "@/lib/types";
import {
  buildPreviewDocument,
  escapeHtml,
  getPathExtension,
  isPreviewableFile,
} from "@/lib/virtual-fs";

export interface PreviewPayload {
  body: string;
  contentType: string;
  status: number;
}

function buildCodePreview(file: Pick<FileRecord, "name" | "path" | "content">, subtitle: string) {
  return buildPreviewDocument({
    title: file.name,
    subtitle,
    body: `<pre>${escapeHtml(file.content)}</pre>`,
  });
}

export function buildMissingPreview(id: string): PreviewPayload {
  return {
    body: buildPreviewDocument({
      title: "Preview unavailable",
      subtitle: `No file was found for id ${id}.`,
      body: '<div class="empty"><p>Select a valid file to preview its last saved output.</p></div>',
      bodyClassName: "empty",
    }),
    contentType: "text/html; charset=utf-8",
    status: 404,
  };
}

export function buildFilePreview(file: Pick<FileRecord, "id" | "name" | "path" | "content">): PreviewPayload {
  const extension = getPathExtension(file.path);

  if (extension === "html" || extension === "htm") {
    return {
      body: file.content,
      contentType: "text/html; charset=utf-8",
      status: 200,
    };
  }

  if (extension === "svg") {
    return {
      body: file.content,
      contentType: "image/svg+xml; charset=utf-8",
      status: 200,
    };
  }

  if (extension === "md" || extension === "markdown") {
    return {
      body: buildCodePreview(
        file,
        "Markdown files are shown as saved source in the offline preview.",
      ),
      contentType: "text/html; charset=utf-8",
      status: 200,
    };
  }

  if (extension === "css") {
    return {
      body: buildCodePreview(
        file,
        "Stylesheets need a host document, so the offline preview shows the saved CSS source.",
      ),
      contentType: "text/html; charset=utf-8",
      status: 200,
    };
  }

  if (["js", "jsx", "ts", "tsx"].includes(extension)) {
    return {
      body: buildCodePreview(
        file,
        "Scripts are not executed in the offline preview. Save changes and run the app to inspect live behavior.",
      ),
      contentType: "text/html; charset=utf-8",
      status: 200,
    };
  }

  if (isPreviewableFile(file.path)) {
    return {
      body: buildCodePreview(
        file,
        "This file type is previewed as last saved source in the offline shell.",
      ),
      contentType: "text/html; charset=utf-8",
      status: 200,
    };
  }

  return {
    body: buildPreviewDocument({
      title: file.name,
      subtitle: "Live preview is not available for this file type in the offline shell.",
      body: `<pre>${escapeHtml(file.content)}</pre>`,
    }),
    contentType: "text/html; charset=utf-8",
    status: 200,
  };
}
