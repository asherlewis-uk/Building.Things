export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface Session {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface FileSummary {
  id: string;
  workspace_id: string;
  name: string;
  path: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface FileRecord extends FileSummary {
  content: string;
}

export interface Artifact {
  id: string;
  session_id: string;
  title: string;
  type: string;
  content: string;
  created_at: string;
}

export interface Deployment {
  id: string;
  session_id: string;
  environment: string;
  status: "pending" | "success" | "failed";
  url: string | null;
  created_at: string;
}

export interface TerminalOutputLine {
  type: "stdout" | "stderr" | "info";
  text: string;
}

export interface TerminalResponse {
  cwd: string;
  cleared: boolean;
  lines: TerminalOutputLine[];
}
