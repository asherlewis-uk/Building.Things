"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  File,
  FileCode,
  FileJson,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SquarePen,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { FileSummary, Session } from "@/lib/types";

type TreeNode = {
  key: string;
  name: string;
  path: string;
  type: "file" | "directory";
  file?: FileSummary;
  children: TreeNode[];
};

function insertFile(root: TreeNode[], file: FileSummary) {
  const segments = file.path.split("/").filter(Boolean);
  let currentLevel = root;
  let builtPath = "";

  segments.forEach((segment, index) => {
    builtPath = builtPath ? `${builtPath}/${segment}` : segment;
    const isFile = index === segments.length - 1;
    let node = currentLevel.find((candidate) => candidate.path === builtPath);

    if (!node) {
      node = {
        key: builtPath,
        name: segment,
        path: builtPath,
        type: isFile ? "file" : "directory",
        file: isFile ? file : undefined,
        children: [],
      };
      currentLevel.push(node);
    }

    if (isFile) {
      node.file = file;
      node.type = "file";
      node.name = file.name;
    }

    currentLevel = node.children;
  });
}

function buildFileTree(files: FileSummary[]) {
  const root: TreeNode[] = [];

  [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach((file) => insertFile(root, file));

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(root);
  return root;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) {
    return nodes;
  }

  const loweredQuery = query.toLowerCase();
  return nodes
    .map((node) => {
      const matches =
        node.name.toLowerCase().includes(loweredQuery) ||
        node.path.toLowerCase().includes(loweredQuery);
      const children = filterTree(node.children, query);

      if (!matches && children.length === 0) {
        return null;
      }

      return {
        ...node,
        children,
      } satisfies TreeNode;
    })
    .filter(Boolean) as TreeNode[];
}

export function SidebarPanel() {
  const {
    currentFileId,
    currentSessionId,
    currentWorkspace,
    currentWorkspaceId,
    files,
    mcpServers,
    refreshFiles,
    refreshSessions,
    refreshWorkspaces,
    setCurrentFileId,
    setCurrentSessionId,
    setCurrentWorkspaceId,
    setSettingsOpen,
    sessions,
    workspaceError,
    workspaces,
  } = useWorkspace();
  const [sidebarError, setSidebarError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const activeError = sidebarError ?? workspaceError;
  const activeSessions = sessions.filter((session) => !session.archived_at);
  const archivedSessions = sessions.filter((session) =>
    Boolean(session.archived_at),
  );
  const fileTree = React.useMemo(
    () => filterTree(buildFileTree(files), searchValue),
    [files, searchValue],
  );
  const readyMcpCount = mcpServers.filter(
    (server) => server.status === "ready",
  ).length;

  const handleNewWorkspace = async () => {
    const name = window.prompt(
      "Workspace name",
      `Workspace ${workspaces.length + 1}`,
    );

    if (!name) {
      return;
    }

    setIsBusy("workspace:create");
    setSidebarError(null);

    try {
      const workspace = await readJsonResponse<{ id: string }>(
        await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      await refreshWorkspaces();
      await setCurrentWorkspaceId(workspace.id);
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to create workspace."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!currentWorkspaceId || !currentWorkspace) {
      return;
    }

    const name = window.prompt("Rename workspace", currentWorkspace.name);

    if (!name || name === currentWorkspace.name) {
      return;
    }

    setIsBusy("workspace:rename");
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/workspaces/${currentWorkspaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      await refreshWorkspaces();
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to rename workspace."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspaceId || !currentWorkspace) {
      return;
    }

    if (!window.confirm(`Delete workspace \"${currentWorkspace.name}\"?`)) {
      return;
    }

    setIsBusy("workspace:delete");
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/workspaces/${currentWorkspaceId}`, {
          method: "DELETE",
        }),
      );
      await refreshWorkspaces();
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to delete workspace."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleCreateSession = async (targetMode: Session["mode"]) => {
    if (!currentWorkspaceId) {
      setSidebarError(
        "Select or create a workspace before creating a session.",
      );
      return;
    }

    setIsBusy(`session:create:${targetMode}`);
    setSidebarError(null);

    try {
      const session = await readJsonResponse<Session>(
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: currentWorkspaceId,
            title: targetMode === "chat" ? "New Chat" : "New Session",
            mode: targetMode,
          }),
        }),
      );
      await refreshSessions();
      setCurrentSessionId(session.id);
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to create session."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleRenameSession = async (session: Session) => {
    const title = window.prompt("Rename session", session.title);

    if (!title || title === session.title) {
      return;
    }

    setIsBusy(`session:rename:${session.id}`);
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }),
      );
      await refreshSessions();
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to rename session."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleArchiveSession = async (session: Session, restore = false) => {
    setIsBusy(`session:archive:${session.id}`);
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            restore ? { restore: true } : { archived: true },
          ),
        }),
      );
      await refreshSessions();
      if (!restore && currentSessionId === session.id) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to update session."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteSession = async (session: Session) => {
    if (!window.confirm(`Delete session \"${session.title}\"?`)) {
      return;
    }

    setIsBusy(`session:delete:${session.id}`);
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/sessions/${session.id}`, {
          method: "DELETE",
        }),
      );
      await refreshSessions();
      if (currentSessionId === session.id) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to delete session."),
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleCreateFile = async () => {
    if (!currentWorkspaceId) {
      setSidebarError("Select a workspace before creating a file.");
      return;
    }

    const path = window.prompt(
      "New file path",
      currentFileId
        ? (files.find((file) => file.id === currentFileId)?.path ??
            "src/new-file.ts")
        : "src/new-file.ts",
    );

    if (!path) {
      return;
    }

    setIsBusy("file:create");
    setSidebarError(null);

    try {
      const file = await readJsonResponse<FileSummary & { content?: string }>(
        await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: currentWorkspaceId, path }),
        }),
      );
      await refreshFiles();
      setCurrentFileId(file.id);
    } catch (error) {
      setSidebarError(getClientErrorMessage(error, "Failed to create file."));
    } finally {
      setIsBusy(null);
    }
  };

  const handleRenameFile = async (file: FileSummary) => {
    const path = window.prompt("Rename file path", file.path);

    if (!path || path === file.path) {
      return;
    }

    setIsBusy(`file:rename:${file.id}`);
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/files/${file.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        }),
      );
      await refreshFiles();
    } catch (error) {
      setSidebarError(getClientErrorMessage(error, "Failed to rename file."));
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteFile = async (file: FileSummary) => {
    if (!window.confirm(`Delete file \"${file.path}\"?`)) {
      return;
    }

    setIsBusy(`file:delete:${file.id}`);
    setSidebarError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/files/${file.id}`, {
          method: "DELETE",
        }),
      );
      await refreshFiles();
      if (currentFileId === file.id) {
        setCurrentFileId(null);
      }
    } catch (error) {
      setSidebarError(getClientErrorMessage(error, "Failed to delete file."));
    } finally {
      setIsBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0c] border-r border-zinc-800 w-[290px]">
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#F6FF00] rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 bg-[#1E1F23] rounded-xs" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 tracking-tight">
                Building.Things
              </span>
              <Badge
                variant="outline"
                className="h-5 px-1 text-[10px] font-mono text-zinc-500 border-zinc-700"
              >
                local
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-500">SQLite-backed IDE shell</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono uppercase text-zinc-500">
                Active Workspace
              </p>
              <select
                className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 outline-none"
                value={currentWorkspaceId ?? ""}
                onChange={(event) =>
                  void setCurrentWorkspaceId(event.target.value)
                }
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                onClick={handleNewWorkspace}
                disabled={isBusy === "workspace:create"}
                title="Create workspace"
              >
                {isBusy === "workspace:create" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                onClick={handleRenameWorkspace}
                disabled={!currentWorkspaceId || isBusy === "workspace:rename"}
                title="Rename workspace"
              >
                <SquarePen className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-red-200"
                onClick={handleDeleteWorkspace}
                disabled={!currentWorkspaceId || isBusy === "workspace:delete"}
                title="Delete workspace"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 shrink-0">
        <Button
          variant="secondary"
          className="justify-start h-9 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          onClick={() => void handleCreateSession("write")}
          disabled={Boolean(isBusy?.startsWith("session:create"))}
        >
          <Plus className="w-4 h-4 mr-2 text-[#F6FF00]" />
          <span className="text-xs font-medium">New Session</span>
        </Button>
        <Button
          variant="ghost"
          className="justify-start h-9 px-2 hover:bg-zinc-900 text-zinc-400"
          onClick={() => void handleCreateSession("chat")}
          disabled={Boolean(isBusy?.startsWith("session:create"))}
        >
          <Plus className="w-4 h-4 mr-2 text-zinc-400" />
          <span className="text-xs">New Chat</span>
        </Button>
      </div>

      {activeError && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-6">
          <div className="space-y-2">
            <SectionLabel label="Sessions" />
            {activeSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                active={session.id === currentSessionId}
                busy={Boolean(isBusy && isBusy.includes(session.id))}
                onClick={() => setCurrentSessionId(session.id)}
                onRename={() => void handleRenameSession(session)}
                onArchive={() => void handleArchiveSession(session)}
                onDelete={() => void handleDeleteSession(session)}
              />
            ))}
            {activeSessions.length === 0 && (
              <div className="px-2 text-xs text-zinc-500">
                No active sessions.
              </div>
            )}
            {archivedSessions.length > 0 && (
              <div className="space-y-2 pt-3">
                <SectionLabel label="Archived" />
                {archivedSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={false}
                    busy={Boolean(isBusy && isBusy.includes(session.id))}
                    onClick={() => setCurrentSessionId(session.id)}
                    onRename={() => void handleRenameSession(session)}
                    onArchive={() => void handleArchiveSession(session, true)}
                    onDelete={() => void handleDeleteSession(session)}
                    archived
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <SectionLabel label="Explorer" />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                  onClick={() => setSearchOpen((previous) => !previous)}
                  title="Search files"
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                  onClick={handleCreateFile}
                  title="Create file"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {searchOpen && (
              <div className="px-2">
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search files"
                  className="border-zinc-800 bg-zinc-950/60 text-zinc-100"
                />
              </div>
            )}
            <div className="pl-1 text-xs font-mono text-zinc-400 select-none">
              {fileTree.length === 0 ? (
                <div className="px-2 text-xs text-zinc-500">No files yet.</div>
              ) : (
                fileTree.map((node) => (
                  <FileTreeNode
                    key={node.key}
                    node={node}
                    depth={0}
                    currentFileId={currentFileId}
                    onSelect={setCurrentFileId}
                    onRename={handleRenameFile}
                    onDelete={handleDeleteFile}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <SectionLabel label="MCP" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-zinc-500 hover:text-zinc-200"
                onClick={() => setSettingsOpen(true)}
              >
                Manage
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  Configured servers
                </span>
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-[10px] text-zinc-400"
                >
                  {mcpServers.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Ready locally</span>
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-[10px] text-zinc-400"
                >
                  {readyMcpCount}
                </Badge>
              </div>
              {mcpServers.slice(0, 3).map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5"
                >
                  <span className="truncate text-[11px] text-zinc-300">
                    {server.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-zinc-700 text-[9px] text-zinc-500"
                  >
                    {server.status}
                  </Badge>
                </div>
              ))}
              {mcpServers.length === 0 && (
                <p className="text-[11px] text-zinc-500">
                  No MCP servers configured for this workspace.
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="h-12 border-t border-zinc-800 flex items-center justify-between px-4 bg-[#0a0a0c] shrink-0">
        <div>
          <p className="text-[10px] font-medium text-zinc-300">
            Local-first mode
          </p>
          <p className="text-[9px] text-zinc-500 font-mono">
            No external model calls
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
      {label}
    </span>
  );
}

function SessionItem({
  session,
  active,
  archived = false,
  busy,
  onClick,
  onRename,
  onArchive,
  onDelete,
}: {
  session: Session;
  active: boolean;
  archived?: boolean;
  busy: boolean;
  onClick: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border border-transparent p-2 transition-all",
        active ? "bg-zinc-900 border-zinc-800/50" : "hover:bg-zinc-900/50",
        archived && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={onClick}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-xs font-medium",
                active
                  ? "text-zinc-100"
                  : "text-zinc-400 group-hover:text-zinc-300",
              )}
            >
              {session.title}
            </span>
            <Badge
              variant="outline"
              className="h-4 border-zinc-800 text-[9px] text-zinc-500"
            >
              {session.mode}
            </Badge>
          </div>
          <span className="text-[10px] text-zinc-600">
            {new Date(session.updated_at).toLocaleString()}
          </span>
        </button>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionIcon title="Rename session" onClick={onRename} disabled={busy}>
            <SquarePen className="h-3.5 w-3.5" />
          </ActionIcon>
          <ActionIcon
            title={archived ? "Restore session" : "Archive session"}
            onClick={onArchive}
            disabled={busy}
          >
            {archived ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </ActionIcon>
          <ActionIcon title="Delete session" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
          </ActionIcon>
        </div>
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  depth,
  currentFileId,
  onSelect,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  currentFileId: string | null;
  onSelect: (id: string) => void;
  onRename: (file: FileSummary) => void;
  onDelete: (file: FileSummary) => void;
}) {
  const [open, setOpen] = React.useState(true);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-zinc-900/50"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setOpen((previous) => !previous)}
        >
          <ChevronDown
            className={cn(
              "h-3 w-3 text-zinc-600 transition-transform",
              !open && "-rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <span className="truncate text-zinc-500 group-hover:text-zinc-300">
            {node.name}
          </span>
        </button>
        {open &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              currentFileId={currentFileId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
      </div>
    );
  }

  const file = node.file;

  if (!file) {
    return null;
  }

  const isSelected = file.id === currentFileId;
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-zinc-900/50",
        isSelected && "bg-zinc-900 text-zinc-200",
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-1.5"
        onClick={() => onSelect(file.id)}
      >
        <FileIcon ext={file.name.split(".").pop()} />
        <span
          className={cn(
            "truncate",
            isSelected
              ? "text-zinc-200"
              : "text-zinc-500 group-hover:text-zinc-300",
          )}
        >
          {file.name}
        </span>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <ActionIcon title="Rename file" onClick={() => onRename(file)}>
          <SquarePen className="h-3 w-3" />
        </ActionIcon>
        <ActionIcon title="Delete file" onClick={() => onDelete(file)}>
          <Trash2 className="h-3 w-3" />
        </ActionIcon>
      </div>
    </div>
  );
}

function ActionIcon({
  children,
  disabled = false,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function FileIcon({ ext }: { ext: string | undefined }) {
  if (ext === "tsx" || ext === "ts") {
    return <FileCode className="w-3.5 h-3.5 text-blue-400/70" />;
  }

  if (ext === "json") {
    return <FileJson className="w-3.5 h-3.5 text-yellow-400/70" />;
  }

  return <File className="w-3.5 h-3.5 text-zinc-600" />;
}
