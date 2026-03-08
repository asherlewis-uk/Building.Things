import { getDb } from "@/lib/db";
import type {
  AppSettings,
  AssistantResponseStyle,
  EnvironmentStatus,
  PanelDensity,
  ResolvedConfig,
  SessionMode,
  Workspace,
  WorkspaceSettings,
} from "@/lib/types";
import { normalizeStoredPath } from "@/lib/virtual-fs";

const APP_SETTINGS_KEY = "app_settings_json";

const DEFAULT_APP_SETTINGS: AppSettings = {
  default_mode: "write",
  panel_density: "comfortable",
  code_font_size: 13,
  preview_default_path: null,
  deploy_target: "local-preview",
  terminal_start_directory: "/",
  assistant_response_style: "balanced",
};

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  default_mode: null,
  panel_density: null,
  code_font_size: null,
  preview_default_path: null,
  deploy_target: null,
  terminal_start_directory: null,
  assistant_response_style: null,
  accent_color: null,
  auto_artifact_snapshots: null,
};

function isSessionMode(value: unknown): value is SessionMode {
  return value === "chat" || value === "write";
}

function isPanelDensity(value: unknown): value is PanelDensity {
  return value === "compact" || value === "comfortable";
}

function isResponseStyle(value: unknown): value is AssistantResponseStyle {
  return value === "concise" || value === "balanced" || value === "detailed";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getDefaultAppSettings() {
  return { ...DEFAULT_APP_SETTINGS };
}

export function getDefaultWorkspaceSettings() {
  return { ...DEFAULT_WORKSPACE_SETTINGS };
}

export function normalizeAppSettings(input: unknown): AppSettings {
  const settings =
    input && typeof input === "object"
      ? (input as Partial<AppSettings>)
      : DEFAULT_APP_SETTINGS;
  const previewDefaultPath = asString(settings.preview_default_path);
  const deployTarget =
    asString(settings.deploy_target) || DEFAULT_APP_SETTINGS.deploy_target;
  const terminalStartDirectory =
    normalizeStoredPath(
      settings.terminal_start_directory ||
        DEFAULT_APP_SETTINGS.terminal_start_directory,
    ) || "/";

  return {
    default_mode: isSessionMode(settings.default_mode)
      ? settings.default_mode
      : DEFAULT_APP_SETTINGS.default_mode,
    panel_density: isPanelDensity(settings.panel_density)
      ? settings.panel_density
      : DEFAULT_APP_SETTINGS.panel_density,
    code_font_size: clampNumber(
      settings.code_font_size,
      11,
      20,
      DEFAULT_APP_SETTINGS.code_font_size,
    ),
    preview_default_path: previewDefaultPath
      ? normalizeStoredPath(previewDefaultPath)
      : null,
    deploy_target: deployTarget,
    terminal_start_directory: terminalStartDirectory.startsWith("/")
      ? terminalStartDirectory
      : `/${terminalStartDirectory}`,
    assistant_response_style: isResponseStyle(settings.assistant_response_style)
      ? settings.assistant_response_style
      : DEFAULT_APP_SETTINGS.assistant_response_style,
  };
}

export function normalizeWorkspaceSettings(input: unknown): WorkspaceSettings {
  const settings =
    input && typeof input === "object"
      ? (input as Partial<WorkspaceSettings>)
      : DEFAULT_WORKSPACE_SETTINGS;
  const previewDefaultPath = asString(settings.preview_default_path);

  return {
    default_mode: isSessionMode(settings.default_mode)
      ? settings.default_mode
      : null,
    panel_density: isPanelDensity(settings.panel_density)
      ? settings.panel_density
      : null,
    code_font_size:
      typeof settings.code_font_size === "number" &&
      Number.isFinite(settings.code_font_size)
        ? clampNumber(settings.code_font_size, 11, 20, 13)
        : null,
    preview_default_path: previewDefaultPath
      ? normalizeStoredPath(previewDefaultPath)
      : null,
    deploy_target: asString(settings.deploy_target) || null,
    terminal_start_directory: (() => {
      const value = asString(settings.terminal_start_directory);
      if (!value) {
        return null;
      }

      const normalized = normalizeStoredPath(value);
      return normalized ? `/${normalized}` : "/";
    })(),
    assistant_response_style: isResponseStyle(settings.assistant_response_style)
      ? settings.assistant_response_style
      : null,
    accent_color: asString(settings.accent_color) || null,
    auto_artifact_snapshots:
      typeof settings.auto_artifact_snapshots === "boolean"
        ? settings.auto_artifact_snapshots
        : null,
  };
}

export function readEnvironmentStatus(): EnvironmentStatus {
  const warnings: string[] = [];
  const appUrl = asString(process.env.APP_URL) || null;
  let appUrlValid = false;

  if (appUrl) {
    try {
      new URL(appUrl);
      appUrlValid = true;
    } catch {
      warnings.push("APP_URL is set but is not a valid URL.");
    }
  }

  return {
    app_url: appUrl,
    app_url_valid: appUrlValid,
    disable_hmr: process.env.DISABLE_HMR === "true",
    providers_enabled: false,
    provider_status: "disabled",
    warnings,
  };
}

export function mergeResolvedSettings(
  appSettings: AppSettings,
  workspaceSettings: WorkspaceSettings,
) {
  return {
    default_mode: workspaceSettings.default_mode ?? appSettings.default_mode,
    panel_density: workspaceSettings.panel_density ?? appSettings.panel_density,
    code_font_size:
      workspaceSettings.code_font_size ?? appSettings.code_font_size,
    preview_default_path:
      workspaceSettings.preview_default_path ??
      appSettings.preview_default_path,
    deploy_target: workspaceSettings.deploy_target ?? appSettings.deploy_target,
    terminal_start_directory:
      workspaceSettings.terminal_start_directory ??
      appSettings.terminal_start_directory,
    assistant_response_style:
      workspaceSettings.assistant_response_style ??
      appSettings.assistant_response_style,
    accent_color: workspaceSettings.accent_color ?? "#F6FF00",
    auto_artifact_snapshots: workspaceSettings.auto_artifact_snapshots ?? true,
  };
}

export async function getStoredAppSettings() {
  const db = await getDb();
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_state WHERE key = ? LIMIT 1",
    [APP_SETTINGS_KEY],
  );

  return normalizeAppSettings(safeJsonParse(row?.value, DEFAULT_APP_SETTINGS));
}

export async function updateAppSettings(patch: Partial<AppSettings>) {
  const db = await getDb();
  const currentSettings = await getStoredAppSettings();
  const nextSettings = normalizeAppSettings({ ...currentSettings, ...patch });
  const updatedAt = new Date().toISOString();

  await db.run(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [APP_SETTINGS_KEY, JSON.stringify(nextSettings), updatedAt],
  );

  return nextSettings;
}

export function parseWorkspaceSettings(
  workspace: Pick<Workspace, "settings_json"> | null,
) {
  return normalizeWorkspaceSettings(
    safeJsonParse(workspace?.settings_json, DEFAULT_WORKSPACE_SETTINGS),
  );
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  patch: Partial<WorkspaceSettings>,
) {
  const db = await getDb();
  const workspace = await db.get<Pick<Workspace, "id" | "settings_json">>(
    "SELECT id, settings_json FROM workspaces WHERE id = ?",
    [workspaceId],
  );

  if (!workspace?.id) {
    throw new Error("Workspace not found");
  }

  const currentSettings = parseWorkspaceSettings(workspace);
  const nextSettings = normalizeWorkspaceSettings({
    ...currentSettings,
    ...patch,
  });
  const updatedAt = new Date().toISOString();

  await db.run(
    "UPDATE workspaces SET settings_json = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(nextSettings), updatedAt, workspaceId],
  );

  return nextSettings;
}

export async function getResolvedConfig(
  workspaceId: string | null,
): Promise<ResolvedConfig> {
  const db = await getDb();
  const [appSettings, workspace] = await Promise.all([
    getStoredAppSettings(),
    workspaceId
      ? db.get<Workspace>("SELECT * FROM workspaces WHERE id = ?", [
          workspaceId,
        ])
      : Promise.resolve(null),
  ]);
  const workspaceSettings = parseWorkspaceSettings(workspace ?? null);

  return {
    app: appSettings,
    workspace: workspaceSettings,
    effective: mergeResolvedSettings(appSettings, workspaceSettings),
    env: readEnvironmentStatus(),
  };
}
