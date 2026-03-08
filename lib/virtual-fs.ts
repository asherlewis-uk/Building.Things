type PathLike = {
  path: string;
};

type NamedPathLike = PathLike & {
  name: string;
};

export interface VirtualDirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

const PREVIEWABLE_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "json",
  "md",
  "markdown",
  "svg",
  "txt",
  "ts",
  "tsx",
]);

function sanitizeSegments(input: string) {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .reduce<string[]>((segments, segment) => {
      if (segment === ".") {
        return segments;
      }

      if (segment === "..") {
        segments.pop();
        return segments;
      }

      segments.push(segment);
      return segments;
    }, []);
}

export function normalizeVirtualPath(input: string | null | undefined) {
  if (!input) {
    return "/";
  }

  const segments = sanitizeSegments(input);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function normalizeStoredPath(input: string | null | undefined) {
  const normalizedPath = normalizeVirtualPath(input);
  return normalizedPath === "/" ? "" : normalizedPath.slice(1);
}

export function resolveVirtualPath(cwd: string, target: string | null | undefined) {
  if (!target || !target.trim()) {
    return normalizeVirtualPath(cwd);
  }

  if (target.startsWith("/")) {
    return normalizeVirtualPath(target);
  }

  const basePath = normalizeVirtualPath(cwd);
  return normalizeVirtualPath(
    basePath === "/" ? target : `${basePath}/${target}`,
  );
}

export function getFileNameFromPath(path: string) {
  const normalizedPath = normalizeStoredPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "untitled.txt";
}

export function dirnameVirtualPath(path: string) {
  const segments = normalizeVirtualPath(path).split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "/";
  }

  return `/${segments.slice(0, -1).join("/")}`;
}

export function inferFileType(path: string) {
  const extension = getPathExtension(path);

  if (!extension) {
    return "text";
  }

  if (["ts", "tsx"].includes(extension)) {
    return "typescript";
  }

  if (["js", "jsx"].includes(extension)) {
    return "javascript";
  }

  if (["md", "markdown"].includes(extension)) {
    return "markdown";
  }

  if (extension === "json") {
    return "json";
  }

  if (extension === "css") {
    return "css";
  }

  if (["html", "htm"].includes(extension)) {
    return "html";
  }

  return extension;
}

export function getPathExtension(path: string) {
  const fileName = getFileNameFromPath(path);
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  return extension?.toLowerCase() ?? "";
}

export function isPreviewableFile(path: string) {
  return PREVIEWABLE_EXTENSIONS.has(getPathExtension(path));
}

export function findFileByVirtualPath<T extends PathLike>(
  files: T[],
  virtualPath: string,
) {
  const normalizedPath = normalizeStoredPath(virtualPath);
  return files.find((file) => normalizeStoredPath(file.path) === normalizedPath);
}

export function directoryExists<T extends PathLike>(
  files: T[],
  virtualPath: string,
) {
  const normalizedPath = normalizeStoredPath(virtualPath);

  if (!normalizedPath) {
    return true;
  }

  return files.some((file) => {
    const storedPath = normalizeStoredPath(file.path);
    return storedPath === normalizedPath || storedPath.startsWith(`${normalizedPath}/`);
  });
}

export function listVirtualDirectory<T extends NamedPathLike>(
  files: T[],
  cwd: string,
): VirtualDirectoryEntry[] {
  const normalizedPath = normalizeStoredPath(cwd);
  const prefix = normalizedPath ? `${normalizedPath}/` : "";
  const entries = new Map<string, VirtualDirectoryEntry>();

  for (const file of files) {
    const storedPath = normalizeStoredPath(file.path);

    if (normalizedPath && storedPath !== normalizedPath && !storedPath.startsWith(prefix)) {
      continue;
    }

    const relativePath = prefix ? storedPath.slice(prefix.length) : storedPath;
    const [firstSegment, ...rest] = relativePath.split("/").filter(Boolean);

    if (!firstSegment) {
      continue;
    }

    const entryPath = normalizeVirtualPath(
      normalizedPath ? `${normalizedPath}/${firstSegment}` : firstSegment,
    );

    if (rest.length === 0) {
      entries.set(firstSegment, {
        name: file.name || firstSegment,
        path: entryPath,
        type: "file",
      });
      continue;
    }

    if (!entries.has(firstSegment)) {
      entries.set(firstSegment, {
        name: firstSegment,
        path: entryPath,
        type: "directory",
      });
    }
  }

  return [...entries.values()].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPreviewDocument(options: {
  title: string;
  subtitle: string;
  body: string;
  bodyClassName?: string;
}) {
  const title = escapeHtml(options.title);
  const subtitle = escapeHtml(options.subtitle);
  const bodyClassName = options.bodyClassName ? ` class="${escapeHtml(options.bodyClassName)}"` : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #09090b;
        color: #e4e4e7;
      }
      main {
        padding: 24px;
      }
      header {
        margin-bottom: 20px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      p {
        margin: 0;
        color: #a1a1aa;
        font-size: 14px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 12px;
        line-height: 1.6;
        padding: 16px;
        border-radius: 12px;
        background: #111115;
        border: 1px solid #27272a;
        color: #d4d4d8;
      }
      .empty {
        display: grid;
        place-items: center;
        min-height: calc(100vh - 48px);
      }
    </style>
  </head>
  <body${bodyClassName}>
    <main>
      <header>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </header>
      ${options.body}
    </main>
  </body>
</html>`;
}
