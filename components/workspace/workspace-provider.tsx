"use client";

import * as React from "react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import type { FileSummary, Session } from "@/lib/types";

interface WorkspaceContextType {
  currentSessionId: string | null;
  currentSession: Session | null;
  setCurrentSessionId: (id: string | null) => void;
  currentFileId: string | null;
  currentFile: FileSummary | null;
  setCurrentFileId: (id: string | null) => void;
  mode: "write" | "chat";
  setMode: (mode: "write" | "chat") => void;
  files: FileSummary[];
  workspaceError: string | null;
  sessions: Session[];
  refreshFiles: () => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    null,
  );
  const [currentFileId, setCurrentFileId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"write" | "chat">("write");
  const [files, setFiles] = React.useState<FileSummary[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(
    null,
  );

  const refreshFiles = React.useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const data = await readJsonResponse<FileSummary[]>(res);
      setFiles(data);
      setCurrentFileId((previousFileId) => {
        if (previousFileId && data.some((file) => file.id === previousFileId)) {
          return previousFileId;
        }

        return data[0]?.id ?? null;
      });
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(getClientErrorMessage(error, "Failed to load files."));
    }
  }, []);

  const refreshSessions = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await readJsonResponse<Session[]>(res);
      setSessions(data);
      setCurrentSessionId((previousSessionId) => {
        if (
          previousSessionId &&
          data.some((session) => session.id === previousSessionId)
        ) {
          return previousSessionId;
        }

        return data[0]?.id ?? null;
      });
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        getClientErrorMessage(error, "Failed to load sessions."),
      );
    }
  }, []);

  React.useEffect(() => {
    void refreshFiles();
    void refreshSessions();
  }, [refreshFiles, refreshSessions]);

  const currentSession = React.useMemo(
    () => sessions.find((session) => session.id === currentSessionId) ?? null,
    [currentSessionId, sessions],
  );

  const currentFile = React.useMemo(
    () => files.find((file) => file.id === currentFileId) ?? null,
    [currentFileId, files],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currentSessionId,
        currentSession,
        setCurrentSessionId,
        currentFileId,
        currentFile,
        setCurrentFileId,
        mode,
        setMode,
        files,
        workspaceError,
        sessions,
        refreshFiles,
        refreshSessions,
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
