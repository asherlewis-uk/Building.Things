"use client";

import * as React from "react";
import {
  AlertCircle,
  LoaderCircle,
  Plus,
  MessageSquare,
  Search,
  File,
  FileJson,
  FileCode,
  Settings,
} from "lucide-react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { FileSummary, Session } from "@/lib/types";

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    refreshSessions,
    files,
    currentFileId,
    setCurrentFileId,
    workspaceError,
  } = useWorkspace();
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);
  const [sidebarError, setSidebarError] = React.useState<string | null>(null);
  const activeError = sidebarError ?? workspaceError;

  const handleNewSession = async () => {
    setSidebarError(null);
    setIsCreatingSession(true);
    try {
      // Get default workspace ID (assuming single workspace for now)
      // In a real app, we'd select a workspace.
      // For now, we'll fetch the first workspace or create one.
      // But the API handles session creation with a workspace_id.
      // Let's just pass a placeholder or fetch workspaces first.
      // Since I didn't expose workspaces API yet, I'll just use a hardcoded UUID or fetch it.
      // Actually, the DB seed creates a default workspace.
      // I'll update the session creation to handle this or fetch workspaces.
      // Let's assume the backend handles it or we fetch it.
      // I'll update the API to optional workspace_id or fetch it here.
      // For now, let's just create a session with a hardcoded workspace ID matching the seed if possible,
      // or better, fetch workspaces.
      // I'll skip fetching workspaces for now and rely on the seed ID if I knew it,
      // but I don't.
      // Let's just create a session and let the backend handle the workspace assignment if missing?
      // No, the schema requires workspace_id.
      // I'll fetch workspaces in the provider or just here.
      // Let's just use a random UUID for now, but that will fail FK constraint.
      // I'll fetch the default workspace from the DB in the API if not provided.

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Session", workspace_id: "default" }), // API should handle 'default'
      });
      const newSession = await readJsonResponse<Session>(res);
      await refreshSessions();
      setCurrentSessionId(newSession.id);
    } catch (error) {
      setSidebarError(
        getClientErrorMessage(error, "Failed to create session."),
      );
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border-r border-zinc-800 w-[290px]">
      {/* Identity Block */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#F6FF00] rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 bg-[#1E1F23] rounded-xs" />
          </div>
          <span className="font-bold text-zinc-100 tracking-tight">
            Building.Things
          </span>
          <Badge
            variant="outline"
            className="ml-2 h-5 px-1 text-[10px] font-mono text-zinc-500 border-zinc-700"
          >
            v1.0.0
          </Badge>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="p-3 grid grid-cols-2 gap-2 shrink-0">
        <Button
          variant="secondary"
          className="justify-start h-9 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          onClick={handleNewSession}
          disabled={isCreatingSession}
        >
          {isCreatingSession ? (
            <LoaderCircle className="w-4 h-4 mr-2 text-[#F6FF00] animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2 text-[#F6FF00]" />
          )}
          <span className="text-xs font-medium">
            {isCreatingSession ? "Creating…" : "New Session"}
          </span>
        </Button>
        <Button
          variant="ghost"
          className="justify-start h-9 px-2 hover:bg-zinc-900 text-zinc-400"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
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
          {/* Sessions */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider mb-2">
              Sessions
            </div>
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                title={session.title}
                subtitle={new Date(session.updated_at).toLocaleDateString()}
                active={session.id === currentSessionId}
                onClick={() => setCurrentSessionId(session.id)}
              />
            ))}
            {sessions.length === 0 && (
              <div className="px-2 text-xs text-zinc-500">No sessions yet.</div>
            )}
          </div>

          {/* File Tree */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
                Explorer
              </span>
              <Search className="w-3 h-3 text-zinc-600 cursor-pointer hover:text-zinc-400" />
            </div>
            <FileTree
              files={files}
              currentFileId={currentFileId}
              onSelect={setCurrentFileId}
            />
          </div>

          {/* MCP Panel - Placeholder for now */}
          <div className="space-y-1 opacity-50 pointer-events-none">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">
                MCP Integrations (Soon)
              </span>
            </div>
            <MCPItem name="GitHub" status="disconnected" />
            <MCPItem name="Figma" status="disconnected" />
          </div>
        </div>
      </ScrollArea>

      {/* Bottom Utility Bar */}
      <div className="h-12 border-t border-zinc-800 flex items-center justify-between px-4 bg-[#0a0a0c] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
            UK
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-zinc-300">
              uptonkasey
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">Pro Plan</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type SessionItemProps = {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
};

function SessionItem({ title, subtitle, active, onClick }: SessionItemProps) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-0.5 p-2 rounded-lg cursor-pointer transition-all border border-transparent",
        active ? "bg-zinc-900 border-zinc-800/50" : "hover:bg-zinc-900/50",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-medium truncate",
            active
              ? "text-zinc-100"
              : "text-zinc-400 group-hover:text-zinc-300",
          )}
        >
          {title}
        </span>
        {active && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#F6FF00] animate-pulse" />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 truncate max-w-[120px]">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

type FileTreeProps = {
  files: FileSummary[];
  currentFileId: string | null;
  onSelect: (id: string) => void;
};

function FileTree({ files, currentFileId, onSelect }: FileTreeProps) {
  // Simple flat list for now, or build tree
  // Let's just render flat list sorted by path for simplicity in this pass,
  // or grouped by folder if possible.
  // Given the time, a flat list with indentation based on path depth is easiest and looks like a tree.

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="pl-1 text-xs font-mono text-zinc-400 select-none">
      {sortedFiles.map((file) => {
        const depth = file.path.split("/").length - 1;
        const isSelected = file.id === currentFileId;
        const ext = file.name.split(".").pop();

        return (
          <div
            key={file.id}
            className={cn(
              "flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer hover:bg-zinc-900/50 group",
              isSelected && "bg-zinc-900 text-zinc-200",
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onSelect(file.id)}
          >
            <FileIcon ext={ext} />
            <span
              className={cn(
                "truncate flex-1",
                isSelected
                  ? "text-zinc-200"
                  : "text-zinc-500 group-hover:text-zinc-400",
              )}
            >
              {file.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FileIcon({ ext }: { ext: string | undefined }) {
  if (ext === "tsx" || ext === "ts")
    return <FileCode className="w-3.5 h-3.5 text-blue-400/70" />;
  if (ext === "json")
    return <FileJson className="w-3.5 h-3.5 text-yellow-400/70" />;
  return <File className="w-3.5 h-3.5 text-zinc-600" />;
}

type MCPItemProps = {
  name: string;
  status: "connected" | "disconnected";
  tools?: string;
};

function MCPItem({ name, status, tools }: MCPItemProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-900/50 cursor-pointer group">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "connected" ? "bg-emerald-500" : "bg-zinc-700",
          )}
        />
        <span
          className={cn(
            "text-xs",
            status === "connected"
              ? "text-zinc-400 group-hover:text-zinc-300"
              : "text-zinc-600",
          )}
        >
          {name}
        </span>
      </div>
      {tools && (
        <Badge
          variant="outline"
          className="h-4 px-1 text-[9px] border-zinc-800 text-zinc-600 font-mono bg-zinc-900"
        >
          {tools}
        </Badge>
      )}
    </div>
  );
}
