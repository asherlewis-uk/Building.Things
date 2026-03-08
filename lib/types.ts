export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  settings_json: string | null;
}

export type SessionMode = "chat" | "write";

export interface Session {
  id: string;
  workspace_id: string;
  title: string;
  mode: SessionMode;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type MessageRole = "user" | "assistant" | "system";

export type AssistantPlanStepStatus = "pending" | "completed" | "blocked";

export type AssistantEventLevel = "info" | "success" | "warning" | "error";

export type FileOperationAction =
  | "create"
  | "update"
  | "append"
  | "rename"
  | "inspect"
  | "none";

export interface AssistantPlanStep {
  id: string;
  label: string;
  status: AssistantPlanStepStatus;
  details?: string;
}

export interface AssistantEvent {
  id: string;
  level: AssistantEventLevel;
  label: string;
  details?: string;
}

export interface AssistantAffectedFile {
  id: string | null;
  path: string;
  action: FileOperationAction;
  status: "planned" | "applied" | "skipped";
}

export interface AssistantWriteResult {
  summary: string;
  applied: boolean;
  artifact_title: string | null;
  plan: AssistantPlanStep[];
  events: AssistantEvent[];
  affected_files: AssistantAffectedFile[];
}

export type StoredMessageKind = "chat" | "write_result";

export interface StoredMessageMetadata {
  kind: StoredMessageKind;
  write_result?: AssistantWriteResult;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  mode: SessionMode;
  metadata_json: string | null;
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
  metadata_json: string | null;
  created_at: string;
}

export type DeploymentStatus = "pending" | "success" | "failed";

export interface DeploymentLogEntry {
  id: string;
  level: AssistantEventLevel;
  text: string;
  created_at: string;
}

export interface Deployment {
  id: string;
  session_id: string;
  environment: string;
  status: DeploymentStatus;
  url: string | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
  logs_json: string | null;
}

export type PanelDensity = "compact" | "comfortable";

export type AssistantResponseStyle = "concise" | "balanced" | "detailed";

export type AiProviderId =
  | "local-stub"
  | "anthropic"
  | "gemini"
  | "openai"
  | "ollama";

export type ProviderStatus =
  | "disabled"
  | "unconfigured"
  | "configured"
  | "ready"
  | "error";

export interface AppSettings {
  default_mode: SessionMode;
  panel_density: PanelDensity;
  code_font_size: number;
  preview_default_path: string | null;
  deploy_target: string;
  terminal_start_directory: string;
  assistant_response_style: AssistantResponseStyle;
  accent_color?: string | null;
  auto_artifact_snapshots?: boolean | null;
  provider?: AiProviderId | null;
  provider_model?: string | null;
  provider_base_url?: string | null;
}

export interface WorkspaceSettings {
  default_mode: SessionMode | null;
  panel_density: PanelDensity | null;
  code_font_size: number | null;
  preview_default_path: string | null;
  deploy_target: string | null;
  terminal_start_directory: string | null;
  assistant_response_style: AssistantResponseStyle | null;
  accent_color: string | null;
  auto_artifact_snapshots: boolean | null;
  provider?: AiProviderId | null;
  provider_model?: string | null;
  provider_base_url?: string | null;
}

export interface EffectiveWorkspaceConfig extends AppSettings {
  accent_color: string;
  auto_artifact_snapshots: boolean;
  provider?: AiProviderId | null;
  provider_model?: string | null;
  provider_base_url?: string | null;
}

export interface EnvironmentStatus {
  app_url: string | null;
  app_url_valid: boolean;
  disable_hmr: boolean;
  providers_enabled: boolean;
  provider_status: ProviderStatus;
  provider?: AiProviderId | null;
  warnings: string[];
}

export interface ResolvedConfig {
  app: AppSettings;
  workspace: WorkspaceSettings;
  effective: EffectiveWorkspaceConfig;
  env: EnvironmentStatus;
}

export type McpTransportType = "stdio" | "http" | "sse";

export type McpAuthMode = "none" | "bearer" | "header";

export type McpStatus = "disabled" | "unconfigured" | "offline" | "ready";

export interface McpAuthConfig {
  bearer_token?: string | null;
  header_name?: string | null;
  header_value?: string | null;
}

export interface McpServer {
  id: string;
  workspace_id: string;
  name: string;
  transport_type: McpTransportType;
  endpoint: string | null;
  command: string | null;
  auth_mode: McpAuthMode;
  auth_config_json?: string | null;
  enabled: boolean;
  status: McpStatus;
  tool_count: number;
  declared_tools_json: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  warnings_json?: string | null;
  created_at: string;
  updated_at: string;
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
