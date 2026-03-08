import { v4 as uuidv4 } from "uuid";
import { ApiRouteError, trimString } from "@/lib/api";
import { getDb } from "@/lib/db";
import type {
  McpAuthMode,
  McpServer,
  McpStatus,
  McpTransportType,
} from "@/lib/types";
import { requireWorkspace } from "@/lib/services/workspaces";

const VALID_TRANSPORTS = new Set<McpTransportType>(["stdio", "http", "sse"]);
const VALID_AUTH_MODES = new Set<McpAuthMode>(["none", "bearer", "header"]);

function normalizeTransport(value: unknown): McpTransportType {
  return VALID_TRANSPORTS.has(value as McpTransportType)
    ? (value as McpTransportType)
    : "http";
}

function normalizeAuthMode(value: unknown): McpAuthMode {
  return VALID_AUTH_MODES.has(value as McpAuthMode)
    ? (value as McpAuthMode)
    : "none";
}

function parseDeclaredTools(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

function parseStoredDeclaredTools(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  try {
    return parseDeclaredTools(JSON.parse(value));
  } catch {
    return [] as string[];
  }
}

export async function listMcpServers(workspaceId: string) {
  const db = await getDb();
  await requireWorkspace(workspaceId);
  return db.all<McpServer[]>(
    "SELECT * FROM mcp_servers WHERE workspace_id = ? ORDER BY updated_at DESC, name ASC",
    [workspaceId],
  );
}

export async function getMcpServerById(mcpId: string) {
  const db = await getDb();
  return db.get<McpServer>("SELECT * FROM mcp_servers WHERE id = ?", [mcpId]);
}

export async function requireMcpServer(mcpId: string) {
  const server = await getMcpServerById(mcpId);

  if (!server) {
    throw new ApiRouteError("MCP server not found", 404);
  }

  return server;
}

export function validateMcpConfiguration(input: {
  transport_type: McpTransportType;
  endpoint: string | null;
  command: string | null;
  enabled: boolean;
  declaredTools: string[];
}) {
  const warnings: string[] = [];
  let status: McpStatus = input.enabled ? "ready" : "disabled";
  let lastError: string | null = null;

  if (!input.enabled) {
    return {
      status,
      toolCount: input.declaredTools.length,
      warnings,
      lastError,
    };
  }

  if (input.transport_type === "stdio") {
    if (!input.command) {
      status = "unconfigured";
      lastError = "A command is required for stdio transports.";
    } else if (input.command.length < 2) {
      status = "unconfigured";
      lastError = "The stdio command is too short to validate.";
    }
  }

  if (input.transport_type === "http" || input.transport_type === "sse") {
    if (!input.endpoint) {
      status = "unconfigured";
      lastError = "An endpoint URL is required for network transports.";
    } else {
      try {
        const url = new URL(input.endpoint);
        if (!["http:", "https:"].includes(url.protocol)) {
          status = "unconfigured";
          lastError = "The endpoint must use http or https.";
        } else {
          status = "offline";
          warnings.push(
            "Connection testing is local-only in this build, so the server remains offline until external transport is enabled.",
          );
        }
      } catch {
        status = "unconfigured";
        lastError = "The endpoint must be a valid URL.";
      }
    }
  }

  return {
    status,
    toolCount: input.declaredTools.length,
    warnings,
    lastError,
  };
}

export async function createMcpServer(input: {
  workspace_id: string;
  name?: unknown;
  transport_type?: unknown;
  endpoint?: unknown;
  command?: unknown;
  auth_mode?: unknown;
  enabled?: unknown;
  declared_tools?: unknown;
}) {
  await requireWorkspace(input.workspace_id);
  const db = await getDb();
  const name = trimString(input.name) ?? "New MCP Server";
  const transportType = normalizeTransport(input.transport_type);
  const authMode = normalizeAuthMode(input.auth_mode);
  const endpoint = trimString(input.endpoint);
  const command = trimString(input.command);
  const enabled = typeof input.enabled === "boolean" ? input.enabled : true;
  const declaredTools = parseDeclaredTools(input.declared_tools);
  const validation = validateMcpConfiguration({
    transport_type: transportType,
    endpoint,
    command,
    enabled,
    declaredTools,
  });

  if (name.length > 80) {
    throw new ApiRouteError("Invalid MCP payload", 400, undefined, {
      name: "Name must be 80 characters or fewer.",
    });
  }

  const now = new Date().toISOString();
  const server: McpServer = {
    id: uuidv4(),
    workspace_id: input.workspace_id,
    name,
    transport_type: transportType,
    endpoint,
    command,
    auth_mode: authMode,
    enabled,
    status: validation.status,
    tool_count: validation.toolCount,
    declared_tools_json: JSON.stringify(declaredTools),
    last_checked_at: now,
    last_error: validation.lastError,
    created_at: now,
    updated_at: now,
  };

  await db.run(
    "INSERT INTO mcp_servers (id, workspace_id, name, transport_type, endpoint, command, auth_mode, enabled, status, tool_count, declared_tools_json, last_checked_at, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      server.id,
      server.workspace_id,
      server.name,
      server.transport_type,
      server.endpoint,
      server.command,
      server.auth_mode,
      server.enabled ? 1 : 0,
      server.status,
      server.tool_count,
      server.declared_tools_json,
      server.last_checked_at,
      server.last_error,
      server.created_at,
      server.updated_at,
    ],
  );

  return server;
}

export async function updateMcpServer(
  mcpId: string,
  patch: {
    name?: unknown;
    transport_type?: unknown;
    endpoint?: unknown;
    command?: unknown;
    auth_mode?: unknown;
    enabled?: unknown;
    declared_tools?: unknown;
  },
) {
  const db = await getDb();
  const existing = await requireMcpServer(mcpId);
  const name = trimString(patch.name) ?? existing.name;
  const transportType =
    patch.transport_type !== undefined
      ? normalizeTransport(patch.transport_type)
      : existing.transport_type;
  const authMode =
    patch.auth_mode !== undefined
      ? normalizeAuthMode(patch.auth_mode)
      : existing.auth_mode;
  const endpoint =
    patch.endpoint !== undefined
      ? trimString(patch.endpoint)
      : existing.endpoint;
  const command =
    patch.command !== undefined ? trimString(patch.command) : existing.command;
  const enabled =
    typeof patch.enabled === "boolean"
      ? patch.enabled
      : Boolean(existing.enabled);
  const declaredTools =
    patch.declared_tools !== undefined
      ? parseDeclaredTools(patch.declared_tools)
      : parseStoredDeclaredTools(existing.declared_tools_json);
  const validation = validateMcpConfiguration({
    transport_type: transportType,
    endpoint,
    command,
    enabled,
    declaredTools,
  });
  const updatedAt = new Date().toISOString();

  if (name.length > 80) {
    throw new ApiRouteError("Invalid MCP payload", 400, undefined, {
      name: "Name must be 80 characters or fewer.",
    });
  }

  const server: McpServer = {
    ...existing,
    name,
    transport_type: transportType,
    endpoint,
    command,
    auth_mode: authMode,
    enabled,
    status: validation.status,
    tool_count: validation.toolCount,
    declared_tools_json: JSON.stringify(declaredTools),
    last_checked_at: updatedAt,
    last_error: validation.lastError,
    updated_at: updatedAt,
  };

  await db.run(
    "UPDATE mcp_servers SET name = ?, transport_type = ?, endpoint = ?, command = ?, auth_mode = ?, enabled = ?, status = ?, tool_count = ?, declared_tools_json = ?, last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
    [
      server.name,
      server.transport_type,
      server.endpoint,
      server.command,
      server.auth_mode,
      server.enabled ? 1 : 0,
      server.status,
      server.tool_count,
      server.declared_tools_json,
      server.last_checked_at,
      server.last_error,
      server.updated_at,
      server.id,
    ],
  );

  return server;
}

export async function testMcpServer(mcpId: string) {
  const existing = await requireMcpServer(mcpId);

  return updateMcpServer(mcpId, {
    transport_type: existing.transport_type,
    endpoint: existing.endpoint,
    command: existing.command,
    auth_mode: existing.auth_mode,
    enabled: existing.enabled,
    declared_tools: parseStoredDeclaredTools(existing.declared_tools_json),
  });
}

export async function deleteMcpServer(mcpId: string) {
  const db = await getDb();
  const server = await requireMcpServer(mcpId);

  await db.run("DELETE FROM mcp_servers WHERE id = ?", [mcpId]);
  return server;
}
