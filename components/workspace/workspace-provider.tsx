"use client";

import * as React from "react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import type {
  FileSummary,
  McpServer,
  ResolvedConfig,
  Session,
  SessionMode,
  Workspace,
} from "@/lib/types";

interface WorkspaceContextType {
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | null;
  setCurrentWorkspaceId: (id: string) => Promise<void>;
  workspaces: Workspace[];
  currentSessionId: string | null;
  currentSession: Session | null;
  setCurrentSessionId: (id: string | null) => void;
  currentFileId: string | null;
  currentFile: FileSummary | null;
  setCurrentFileId: (id: string | null) => void;
  mode: SessionMode;
  setMode: (mode: SessionMode) => Promise<void>;
  files: FileSummary[];
  mcpServers: McpServer[];
  resolvedConfig: ResolvedConfig | null;
  workspaceError: string | null;
  sessions: Session[];
  refreshFiles: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshMcpServers: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = React.useState<
    string | null
  >(null);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    null,
  );
  const [currentFileId, setCurrentFileId] = React.useState<string | null>(null);
  const [mode, setModeState] = React.useState<SessionMode>("write");
  const [files, setFiles] = React.useState<FileSummary[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [mcpServers, setMcpServers] = React.useState<McpServer[]>([]);
  const [resolvedConfig, setResolvedConfig] =
    React.useState<ResolvedConfig | null>(null);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(
    null,
  );
  const [isSettingsOpen, setSettingsOpen] = React.useState(false);

  const currentWorkspace = React.useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === currentWorkspaceId) ??
      null,
    [currentWorkspaceId, workspaces],
  );

  const currentSession = React.useMemo(
    () => sessions.find((session) => session.id === currentSessionId) ?? null,
    [currentSessionId, sessions],
  );

  const currentFile = React.useMemo(
    () => files.find((file) => file.id === currentFileId) ?? null,
    [currentFileId, files],
  );

  const refreshWorkspaces = React.useCallback(async () => {
    try {
      const [activeRes, workspacesRes] = await Promise.all([
        fetch("/api/workspaces/active"),
        fetch("/api/workspaces"),
      ]);
      const [activeWorkspace, workspaceList] = await Promise.all([
        readJsonResponse<Workspace>(activeRes),
        readJsonResponse<Workspace[]>(workspacesRes),
      ]);

      setWorkspaces(workspaceList);
      setCurrentWorkspaceIdState((previousWorkspaceId) => {
        if (
          workspaceList.some((workspace) => workspace.id === activeWorkspace.id)
        ) {
          return activeWorkspace.id;
        }

        if (
          previousWorkspaceId &&
          workspaceList.some(
            (workspace) => workspace.id === previousWorkspaceId,
          )
        ) {
          return previousWorkspaceId;
        }

        return workspaceList[0]?.id ?? null;
      });
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        getClientErrorMessage(error, "Failed to load workspaces."),
      );
    }
  }, []);

  const refreshFiles = React.useCallback(async () => {
    if (!currentWorkspaceId) {
      setFiles([]);
      setCurrentFileId(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/files?workspace_id=${encodeURIComponent(currentWorkspaceId)}`,
      );
      const data = await readJsonResponse<FileSummary[]>(res);
      setFiles(data);
      setCurrentFileId((previousFileId) => {
        if (previousFileId && data.some((file) => file.id === previousFileId)) {
          return previousFileId;
        }

        const configuredPath = resolvedConfig?.effective.preview_default_path;

        if (configuredPath) {
          const configuredFile = data.find(
            (file) => file.path === configuredPath,
          );
          if (configuredFile) {
            return configuredFile.id;
          }
        }

        return data[0]?.id ?? null;
      });
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(getClientErrorMessage(error, "Failed to load files."));
    }
  }, [currentWorkspaceId, resolvedConfig?.effective.preview_default_path]);

  const refreshSessions = React.useCallback(async () => {
    if (!currentWorkspaceId) {
      setSessions([]);
      setCurrentSessionId(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/sessions?workspace_id=${encodeURIComponent(currentWorkspaceId)}&include_archived=1`,
      );
      const data = await readJsonResponse<Session[]>(res);
      setSessions(data);
      setCurrentSessionId((previousSessionId) => {
        if (
          previousSessionId &&
          data.some((session) => session.id === previousSessionId)
        ) {
          return previousSessionId;
        }

        return (
          data.find((session) => !session.archived_at)?.id ??
          data[0]?.id ??
          null
        );
      });
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        getClientErrorMessage(error, "Failed to load sessions."),
      );
    }
  }, [currentWorkspaceId]);

  const refreshMcpServers = React.useCallback(async () => {
    if (!currentWorkspaceId) {
      setMcpServers([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/mcp?workspace_id=${encodeURIComponent(currentWorkspaceId)}`,
      );
      const data = await readJsonResponse<McpServer[]>(res);
      setMcpServers(data);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        getClientErrorMessage(error, "Failed to load MCP servers."),
      );
    }
  }, [currentWorkspaceId]);

  const refreshConfig = React.useCallback(async () => {
    if (!currentWorkspaceId) {
      setResolvedConfig(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/config?workspace_id=${encodeURIComponent(currentWorkspaceId)}`,
      );
      const data = await readJsonResponse<ResolvedConfig>(res);
      setResolvedConfig(data);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(getClientErrorMessage(error, "Failed to load config."));
    }
  }, [currentWorkspaceId]);

  const refreshWorkspaceScope = React.useCallback(async () => {
    await Promise.all([
      refreshConfig(),
      refreshSessions(),
      refreshFiles(),
      refreshMcpServers(),
    ]);
  }, [refreshConfig, refreshFiles, refreshMcpServers, refreshSessions]);

  React.useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  React.useEffect(() => {
    if (!currentWorkspaceId) {
      return;
    }

    void refreshWorkspaceScope();
  }, [currentWorkspaceId, refreshWorkspaceScope]);

  React.useEffect(() => {
    if (currentSession?.mode) {
      setModeState(currentSession.mode);
      return;
    }

    if (resolvedConfig?.effective.default_mode) {
      setModeState(resolvedConfig.effective.default_mode);
    }
  }, [currentSession?.mode, resolvedConfig?.effective.default_mode]);

  const setCurrentWorkspaceId = React.useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: id }),
      });
      const workspace = await readJsonResponse<Workspace>(res);
      setCurrentWorkspaceIdState(workspace.id);
      setCurrentSessionId(null);
      setCurrentFileId(null);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        getClientErrorMessage(error, "Failed to switch workspaces."),
      );
    }
  }, []);

  const setMode = React.useCallback(
    async (nextMode: SessionMode) => {
      setModeState(nextMode);

      try {
        if (currentSessionId) {
          const res = await fetch(`/api/sessions/${currentSessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: nextMode }),
          });
          const session = await readJsonResponse<Session>(res);
          setSessions((previousSessions) =>
            previousSessions.map((previousSession) =>
              previousSession.id === session.id ? session : previousSession,
            ),
          );
        } else if (currentWorkspaceId) {
          await fetch("/api/config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: currentWorkspaceId,
              workspace: { default_mode: nextMode },
            }),
          });
          await refreshConfig();
        }

        setWorkspaceError(null);
      } catch (error) {
        setWorkspaceError(
          getClientErrorMessage(error, "Failed to update mode."),
        );
      }
    },
    [currentSessionId, currentWorkspaceId, refreshConfig],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspaceId,
        currentWorkspace,
        setCurrentWorkspaceId,
        workspaces,
        currentSessionId,
        currentSession,
        setCurrentSessionId,
        currentFileId,
        currentFile,
        setCurrentFileId,
        mode,
        setMode,
        files,
        mcpServers,
        resolvedConfig,
        workspaceError,
        sessions,
        refreshFiles,
        refreshSessions,
        refreshWorkspaces,
        refreshMcpServers,
        refreshConfig,
        isSettingsOpen,
        setSettingsOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
