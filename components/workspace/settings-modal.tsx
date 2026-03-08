"use client";

import * as React from "react";
import {
  AlertCircle,
  LoaderCircle,
  PlugZap,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { McpServer, ResolvedConfig } from "@/lib/types";

type SettingsFormState = {
  app: {
    default_mode: string;
    panel_density: string;
    code_font_size: string;
    preview_default_path: string;
    deploy_target: string;
    terminal_start_directory: string;
    assistant_response_style: string;
  };
  workspace: {
    default_mode: string;
    panel_density: string;
    code_font_size: string;
    preview_default_path: string;
    deploy_target: string;
    terminal_start_directory: string;
    assistant_response_style: string;
    accent_color: string;
    auto_artifact_snapshots: boolean;
  };
};

type McpFormState = {
  name: string;
  transport_type: "http" | "sse" | "stdio";
  endpoint: string;
  command: string;
  auth_mode: "none" | "bearer" | "header";
  enabled: boolean;
  declared_tools: string;
};

function buildSettingsForm(config: ResolvedConfig | null): SettingsFormState {
  return {
    app: {
      default_mode: config?.app.default_mode ?? "write",
      panel_density: config?.app.panel_density ?? "comfortable",
      code_font_size: String(config?.app.code_font_size ?? 13),
      preview_default_path: config?.app.preview_default_path ?? "",
      deploy_target: config?.app.deploy_target ?? "local-preview",
      terminal_start_directory: config?.app.terminal_start_directory ?? "/",
      assistant_response_style:
        config?.app.assistant_response_style ?? "balanced",
    },
    workspace: {
      default_mode: config?.workspace.default_mode ?? "",
      panel_density: config?.workspace.panel_density ?? "",
      code_font_size:
        config?.workspace.code_font_size != null
          ? String(config.workspace.code_font_size)
          : "",
      preview_default_path: config?.workspace.preview_default_path ?? "",
      deploy_target: config?.workspace.deploy_target ?? "",
      terminal_start_directory:
        config?.workspace.terminal_start_directory ?? "",
      assistant_response_style:
        config?.workspace.assistant_response_style ?? "",
      accent_color: config?.workspace.accent_color ?? "#F6FF00",
      auto_artifact_snapshots:
        config?.workspace.auto_artifact_snapshots ?? true,
    },
  };
}

function buildMcpForm(server?: McpServer | null): McpFormState {
  const declaredTools = (() => {
    if (!server?.declared_tools_json) {
      return "";
    }

    try {
      return (JSON.parse(server.declared_tools_json) as string[]).join(", ");
    } catch {
      return "";
    }
  })();

  return {
    name: server?.name ?? "",
    transport_type: server?.transport_type ?? "http",
    endpoint: server?.endpoint ?? "",
    command: server?.command ?? "",
    auth_mode: server?.auth_mode ?? "none",
    enabled: server ? Boolean(server.enabled) : true,
    declared_tools: declaredTools,
  };
}

export function SettingsModal() {
  const {
    currentWorkspace,
    currentWorkspaceId,
    isSettingsOpen,
    setSettingsOpen,
    mcpServers,
    refreshConfig,
    refreshMcpServers,
    resolvedConfig,
  } = useWorkspace();
  const [settingsForm, setSettingsForm] = React.useState<SettingsFormState>(
    () => buildSettingsForm(resolvedConfig),
  );
  const [mcpForm, setMcpForm] = React.useState<McpFormState>(() =>
    buildMcpForm(),
  );
  const [editingMcpId, setEditingMcpId] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<
    "general" | "workspace" | "mcp" | "environment"
  >("general");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);
  const [isSavingMcp, setIsSavingMcp] = React.useState(false);
  const [testingMcpId, setTestingMcpId] = React.useState<string | null>(null);
  const [deletingMcpId, setDeletingMcpId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSettingsForm(buildSettingsForm(resolvedConfig));
  }, [resolvedConfig]);

  React.useEffect(() => {
    if (!isSettingsOpen) {
      setActiveSection("general");
      setErrorMessage(null);
      setSuccessMessage(null);
      setEditingMcpId(null);
      setMcpForm(buildMcpForm());
    }
  }, [isSettingsOpen]);

  const handleClose = React.useCallback(() => {
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  React.useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isSettingsOpen]);

  if (!isSettingsOpen) {
    return null;
  }

  const handleSaveConfig = async () => {
    if (!currentWorkspaceId) {
      setErrorMessage("Select a workspace before editing settings.");
      return;
    }

    setIsSavingConfig(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: currentWorkspaceId,
          app: {
            default_mode: settingsForm.app.default_mode,
            panel_density: settingsForm.app.panel_density,
            code_font_size: Number(settingsForm.app.code_font_size),
            preview_default_path: settingsForm.app.preview_default_path || null,
            deploy_target: settingsForm.app.deploy_target,
            terminal_start_directory: settingsForm.app.terminal_start_directory,
            assistant_response_style: settingsForm.app.assistant_response_style,
          },
          workspace: {
            default_mode: settingsForm.workspace.default_mode || null,
            panel_density: settingsForm.workspace.panel_density || null,
            code_font_size: settingsForm.workspace.code_font_size
              ? Number(settingsForm.workspace.code_font_size)
              : null,
            preview_default_path:
              settingsForm.workspace.preview_default_path || null,
            deploy_target: settingsForm.workspace.deploy_target || null,
            terminal_start_directory:
              settingsForm.workspace.terminal_start_directory || null,
            assistant_response_style:
              settingsForm.workspace.assistant_response_style || null,
            accent_color: settingsForm.workspace.accent_color || null,
            auto_artifact_snapshots:
              settingsForm.workspace.auto_artifact_snapshots,
          },
        }),
      });
      const data = await readJsonResponse<ResolvedConfig>(res);
      setSettingsForm(buildSettingsForm(data));
      await refreshConfig();
      setSuccessMessage("Settings saved.");
    } catch (error) {
      setErrorMessage(getClientErrorMessage(error, "Failed to save settings."));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveMcp = async () => {
    if (!currentWorkspaceId) {
      setErrorMessage("Select a workspace before configuring MCP servers.");
      return;
    }

    setIsSavingMcp(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const endpoint = editingMcpId ? `/api/mcp/${editingMcpId}` : "/api/mcp";
      const method = editingMcpId ? "PATCH" : "POST";
      await readJsonResponse<McpServer>(
        await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: currentWorkspaceId,
            name: mcpForm.name,
            transport_type: mcpForm.transport_type,
            endpoint: mcpForm.endpoint || null,
            command: mcpForm.command || null,
            auth_mode: mcpForm.auth_mode,
            enabled: mcpForm.enabled,
            declared_tools: mcpForm.declared_tools,
          }),
        }),
      );
      await refreshMcpServers();
      setEditingMcpId(null);
      setMcpForm(buildMcpForm());
      setSuccessMessage(
        editingMcpId ? "MCP server updated." : "MCP server created.",
      );
    } catch (error) {
      setErrorMessage(
        getClientErrorMessage(error, "Failed to save MCP server."),
      );
    } finally {
      setIsSavingMcp(false);
    }
  };

  const handleTestMcp = async (serverId: string) => {
    setTestingMcpId(serverId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await readJsonResponse<McpServer>(
        await fetch(`/api/mcp/${serverId}/test`, { method: "POST" }),
      );
      await refreshMcpServers();
      setSuccessMessage("MCP validation completed.");
    } catch (error) {
      setErrorMessage(
        getClientErrorMessage(error, "Failed to validate MCP server."),
      );
    } finally {
      setTestingMcpId(null);
    }
  };

  const handleDeleteMcp = async (serverId: string) => {
    if (!window.confirm("Delete this MCP server definition?")) {
      return;
    }

    setDeletingMcpId(serverId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await readJsonResponse<{ success: true }>(
        await fetch(`/api/mcp/${serverId}`, { method: "DELETE" }),
      );
      await refreshMcpServers();
      if (editingMcpId === serverId) {
        setEditingMcpId(null);
        setMcpForm(buildMcpForm());
      }
      setSuccessMessage("MCP server deleted.");
    } catch (error) {
      setErrorMessage(
        getClientErrorMessage(error, "Failed to delete MCP server."),
      );
    } finally {
      setDeletingMcpId(null);
    }
  };

  const envWarnings = resolvedConfig?.env.warnings ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={handleClose} />
      <div className="absolute inset-y-6 right-6 flex w-[min(880px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0a0c] shadow-2xl shadow-black/60">
        <div className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Workspace Settings
              </p>
              <p className="text-[11px] text-zinc-500">
                {currentWorkspace?.name ?? "No workspace selected"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 space-y-2">
            <NavButton
              active={activeSection === "general"}
              label="General"
              onClick={() => setActiveSection("general")}
            />
            <NavButton
              active={activeSection === "workspace"}
              label="Workspace"
              onClick={() => setActiveSection("workspace")}
            />
            <NavButton
              active={activeSection === "mcp"}
              label="MCP"
              onClick={() => setActiveSection("mcp")}
            />
            <NavButton
              active={activeSection === "environment"}
              label="Environment"
              onClick={() => setActiveSection("environment")}
            />
          </div>
          <div className="mt-auto border-t border-zinc-800 px-4 py-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-[11px] font-medium text-zinc-300">
                Provider Status
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                External providers stay disabled in this local build.
              </p>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Local-first configuration
              </p>
              <p className="text-[11px] text-zinc-500">
                Settings, MCP definitions, and env status are persisted locally.
              </p>
            </div>
            <Button
              variant="secondary"
              className="h-8 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              onClick={handleSaveConfig}
              disabled={isSavingConfig || activeSection === "mcp"}
            >
              {isSavingConfig ? (
                <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Save Settings
            </Button>
          </div>
          {(errorMessage || successMessage) && (
            <div className="border-b border-zinc-800 px-5 py-3">
              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200">
                  {successMessage}
                </div>
              )}
            </div>
          )}
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-6">
              {activeSection === "general" && (
                <div className="space-y-5">
                  <SectionTitle
                    title="App defaults"
                    description="These values apply across workspaces unless the current workspace overrides them."
                  />
                  <SettingsGrid>
                    <SelectField
                      label="Default Mode"
                      value={settingsForm.app.default_mode}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: { ...previous.app, default_mode: value },
                        }))
                      }
                      options={[
                        { label: "Write", value: "write" },
                        { label: "Chat", value: "chat" },
                      ]}
                    />
                    <SelectField
                      label="Panel Density"
                      value={settingsForm.app.panel_density}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: { ...previous.app, panel_density: value },
                        }))
                      }
                      options={[
                        { label: "Comfortable", value: "comfortable" },
                        { label: "Compact", value: "compact" },
                      ]}
                    />
                    <FormField
                      label="Code Font Size"
                      value={settingsForm.app.code_font_size}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: { ...previous.app, code_font_size: value },
                        }))
                      }
                    />
                    <SelectField
                      label="Assistant Response Style"
                      value={settingsForm.app.assistant_response_style}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: {
                            ...previous.app,
                            assistant_response_style: value,
                          },
                        }))
                      }
                      options={[
                        { label: "Balanced", value: "balanced" },
                        { label: "Concise", value: "concise" },
                        { label: "Detailed", value: "detailed" },
                      ]}
                    />
                    <FormField
                      label="Default Preview Path"
                      value={settingsForm.app.preview_default_path}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: { ...previous.app, preview_default_path: value },
                        }))
                      }
                    />
                    <FormField
                      label="Deploy Target"
                      value={settingsForm.app.deploy_target}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: { ...previous.app, deploy_target: value },
                        }))
                      }
                    />
                    <FormField
                      label="Terminal Start Directory"
                      value={settingsForm.app.terminal_start_directory}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          app: {
                            ...previous.app,
                            terminal_start_directory: value,
                          },
                        }))
                      }
                    />
                  </SettingsGrid>
                </div>
              )}
              {activeSection === "workspace" && (
                <div className="space-y-5">
                  <SectionTitle
                    title="Workspace overrides"
                    description="These values apply only to the active workspace. Leave fields blank to inherit app defaults."
                  />
                  <SettingsGrid>
                    <SelectField
                      label="Workspace Default Mode"
                      value={settingsForm.workspace.default_mode}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            default_mode: value,
                          },
                        }))
                      }
                      options={[
                        { label: "Inherit", value: "" },
                        { label: "Write", value: "write" },
                        { label: "Chat", value: "chat" },
                      ]}
                    />
                    <SelectField
                      label="Workspace Density"
                      value={settingsForm.workspace.panel_density}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            panel_density: value,
                          },
                        }))
                      }
                      options={[
                        { label: "Inherit", value: "" },
                        { label: "Comfortable", value: "comfortable" },
                        { label: "Compact", value: "compact" },
                      ]}
                    />
                    <FormField
                      label="Workspace Font Size"
                      value={settingsForm.workspace.code_font_size}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            code_font_size: value,
                          },
                        }))
                      }
                    />
                    <SelectField
                      label="Workspace Response Style"
                      value={settingsForm.workspace.assistant_response_style}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            assistant_response_style: value,
                          },
                        }))
                      }
                      options={[
                        { label: "Inherit", value: "" },
                        { label: "Balanced", value: "balanced" },
                        { label: "Concise", value: "concise" },
                        { label: "Detailed", value: "detailed" },
                      ]}
                    />
                    <FormField
                      label="Workspace Preview Path"
                      value={settingsForm.workspace.preview_default_path}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            preview_default_path: value,
                          },
                        }))
                      }
                    />
                    <FormField
                      label="Workspace Deploy Target"
                      value={settingsForm.workspace.deploy_target}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            deploy_target: value,
                          },
                        }))
                      }
                    />
                    <FormField
                      label="Workspace Terminal Directory"
                      value={settingsForm.workspace.terminal_start_directory}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            terminal_start_directory: value,
                          },
                        }))
                      }
                    />
                    <FormField
                      label="Accent Color"
                      value={settingsForm.workspace.accent_color}
                      onChange={(value) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            accent_color: value,
                          },
                        }))
                      }
                    />
                  </SettingsGrid>
                  <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={settingsForm.workspace.auto_artifact_snapshots}
                      onChange={(event) =>
                        setSettingsForm((previous) => ({
                          ...previous,
                          workspace: {
                            ...previous.workspace,
                            auto_artifact_snapshots: event.target.checked,
                          },
                        }))
                      }
                    />
                    Automatically capture write-mode artifacts for this
                    workspace
                  </label>
                </div>
              )}
              {activeSection === "mcp" && (
                <div className="space-y-6">
                  <SectionTitle
                    title="MCP servers"
                    description="These definitions are stored locally. Validation is local-only and reports honest readiness states."
                  />
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-3">
                      {mcpServers.length === 0 ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
                          No MCP server definitions exist for this workspace
                          yet.
                        </div>
                      ) : (
                        mcpServers.map((server) => (
                          <div
                            key={server.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium text-zinc-100">
                                    {server.name}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="border-zinc-700 text-[10px] text-zinc-400"
                                  >
                                    {server.transport_type}
                                  </Badge>
                                  <StatusBadge status={server.status} />
                                </div>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  {server.command ||
                                    server.endpoint ||
                                    "No transport target configured."}
                                </p>
                                <p className="mt-2 text-[11px] text-zinc-400">
                                  {server.tool_count} declared tool
                                  {server.tool_count === 1 ? "" : "s"}
                                </p>
                                {server.last_error && (
                                  <p className="mt-2 text-[11px] text-red-300">
                                    {server.last_error}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                                  onClick={() => {
                                    setEditingMcpId(server.id);
                                    setMcpForm(buildMcpForm(server));
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                                  onClick={() => handleTestMcp(server.id)}
                                  disabled={testingMcpId === server.id}
                                >
                                  {testingMcpId === server.id
                                    ? "Testing…"
                                    : "Test"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-zinc-500 hover:text-red-200"
                                  onClick={() => handleDeleteMcp(server.id)}
                                  disabled={deletingMcpId === server.id}
                                >
                                  {deletingMcpId === server.id ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">
                            {editingMcpId
                              ? "Edit MCP Server"
                              : "New MCP Server"}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Local configuration only.
                          </p>
                        </div>
                        {editingMcpId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                            onClick={() => {
                              setEditingMcpId(null);
                              setMcpForm(buildMcpForm());
                            }}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                      <FormField
                        label="Name"
                        value={mcpForm.name}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            name: value,
                          }))
                        }
                      />
                      <SelectField
                        label="Transport"
                        value={mcpForm.transport_type}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            transport_type:
                              value as McpFormState["transport_type"],
                          }))
                        }
                        options={[
                          { label: "HTTP", value: "http" },
                          { label: "SSE", value: "sse" },
                          { label: "stdio", value: "stdio" },
                        ]}
                      />
                      <FormField
                        label="Endpoint"
                        value={mcpForm.endpoint}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            endpoint: value,
                          }))
                        }
                      />
                      <FormField
                        label="Command"
                        value={mcpForm.command}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            command: value,
                          }))
                        }
                      />
                      <SelectField
                        label="Auth Mode"
                        value={mcpForm.auth_mode}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            auth_mode: value as McpFormState["auth_mode"],
                          }))
                        }
                        options={[
                          { label: "None", value: "none" },
                          { label: "Bearer", value: "bearer" },
                          { label: "Header", value: "header" },
                        ]}
                      />
                      <FormField
                        label="Declared Tools"
                        value={mcpForm.declared_tools}
                        onChange={(value) =>
                          setMcpForm((previous) => ({
                            ...previous,
                            declared_tools: value,
                          }))
                        }
                      />
                      <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={mcpForm.enabled}
                          onChange={(event) =>
                            setMcpForm((previous) => ({
                              ...previous,
                              enabled: event.target.checked,
                            }))
                          }
                        />
                        Enabled
                      </label>
                      <Button
                        className="w-full bg-[#F6FF00] text-black hover:bg-[#F6FF00]/90"
                        onClick={handleSaveMcp}
                        disabled={isSavingMcp}
                      >
                        {isSavingMcp ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PlugZap className="mr-2 h-4 w-4" />
                        )}
                        {editingMcpId ? "Save MCP Server" : "Create MCP Server"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {activeSection === "environment" && (
                <div className="space-y-5">
                  <SectionTitle
                    title="Environment status"
                    description="The app is fully local-first. External model providers remain intentionally disabled."
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <EnvironmentCard
                      title="APP_URL"
                      value={resolvedConfig?.env.app_url ?? "Not set"}
                      tone={
                        resolvedConfig?.env.app_url_valid
                          ? "success"
                          : "default"
                      }
                    />
                    <EnvironmentCard
                      title="Disable HMR"
                      value={resolvedConfig?.env.disable_hmr ? "true" : "false"}
                    />
                    <EnvironmentCard
                      title="External Providers"
                      value="Disabled"
                      tone="warning"
                    />
                    <EnvironmentCard
                      title="Active Workspace"
                      value={currentWorkspace?.name ?? "None"}
                    />
                  </div>
                  {envWarnings.length > 0 && (
                    <div className="space-y-2">
                      {envWarnings.map((warning) => (
                        <div
                          key={warning}
                          className="flex items-start gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200"
                        >
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "border-zinc-700 bg-zinc-900 text-zinc-100"
          : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/50 hover:text-zinc-300"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-zinc-500" />
        <p className="text-sm font-medium text-zinc-100">{title}</p>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{description}</p>
    </div>
  );
}

function SettingsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-zinc-800 bg-zinc-950/60 text-zinc-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-sm text-zinc-100 shadow-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: McpServer["status"] }) {
  const styles = {
    disabled: "border-zinc-700 text-zinc-500",
    unconfigured: "border-amber-700/50 bg-amber-950/30 text-amber-200",
    offline: "border-blue-700/50 bg-blue-950/30 text-blue-200",
    ready: "border-emerald-700/50 bg-emerald-950/30 text-emerald-200",
  } as const;

  return (
    <Badge variant="outline" className={`text-[10px] ${styles[status]}`}>
      {status}
    </Badge>
  );
}

function EnvironmentCard({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-800/60 bg-emerald-950/20"
      : tone === "warning"
        ? "border-amber-800/60 bg-amber-950/20"
        : "border-zinc-800 bg-zinc-950/60";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <p className="mt-2 break-all text-sm text-zinc-200">{value}</p>
    </div>
  );
}
