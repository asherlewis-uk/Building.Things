import { v4 as uuidv4 } from "uuid";
import { ApiRouteError, trimString } from "@/lib/api";
import { getDb } from "@/lib/db";
import { readEnvironmentStatus } from "@/lib/services/config";
import { requireSession } from "@/lib/services/workspaces";
import type {
  Deployment,
  DeploymentLogEntry,
  DeploymentStatus,
} from "@/lib/types";

function serializeLogs(logs: DeploymentLogEntry[]) {
  return JSON.stringify(logs);
}

function buildDeploymentUrl() {
  const env = readEnvironmentStatus();
  return env.app_url_valid && env.app_url
    ? env.app_url
    : "http://localhost:3000";
}

export async function listDeployments(sessionId: string) {
  const db = await getDb();
  await requireSession(sessionId);
  return db.all<Deployment[]>(
    "SELECT id, session_id, environment, status, url, created_at, updated_at, summary, logs_json FROM deployments WHERE session_id = ? ORDER BY created_at DESC",
    [sessionId],
  );
}

export async function createPseudoDeployment(input: {
  session_id: string;
  environment?: unknown;
  url?: unknown;
  summary?: unknown;
}) {
  const db = await getDb();
  const session = await requireSession(input.session_id);
  const createdAt = new Date().toISOString();
  const environment = trimString(input.environment) ?? "local-preview";
  const url = trimString(input.url) ?? buildDeploymentUrl();

  if (environment.length > 60) {
    throw new ApiRouteError("Invalid deployment payload", 400, undefined, {
      environment: "Environment must be 60 characters or fewer.",
    });
  }

  const logs: DeploymentLogEntry[] = [
    {
      id: uuidv4(),
      level: "info",
      text: `Preparing local deployment bundle for ${environment}.`,
      created_at: createdAt,
    },
    {
      id: uuidv4(),
      level: "info",
      text: "Collecting saved workspace files and preview settings.",
      created_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      level: "success",
      text: `Local deployment is available at ${url}.`,
      created_at: new Date().toISOString(),
    },
  ];
  const deployment: Deployment = {
    id: uuidv4(),
    session_id: session.id,
    environment,
    status: "success",
    url,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    summary:
      trimString(input.summary) ??
      "Local deployment completed and recorded for this session.",
    logs_json: serializeLogs(logs),
  };

  await db.run(
    "INSERT INTO deployments (id, session_id, environment, status, url, created_at, updated_at, summary, logs_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      deployment.id,
      deployment.session_id,
      deployment.environment,
      deployment.status,
      deployment.url,
      deployment.created_at,
      deployment.updated_at,
      deployment.summary,
      deployment.logs_json,
    ],
  );
  await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
    deployment.updated_at,
    session.id,
  ]);

  return deployment;
}

export async function updateDeploymentStatus(
  deploymentId: string,
  status: DeploymentStatus,
  message: string,
) {
  const db = await getDb();
  const deployment = await db.get<Deployment>(
    "SELECT id, session_id, environment, status, url, created_at, updated_at, summary, logs_json FROM deployments WHERE id = ?",
    [deploymentId],
  );

  if (!deployment) {
    throw new ApiRouteError("Deployment not found", 404);
  }

  const existingLogs = deployment.logs_json
    ? (JSON.parse(deployment.logs_json) as DeploymentLogEntry[])
    : [];
  const updatedAt = new Date().toISOString();
  const nextLogEntry: DeploymentLogEntry = {
    id: uuidv4(),
    level:
      status === "failed" ? "error" : status === "success" ? "success" : "info",
    text: message,
    created_at: updatedAt,
  };
  const nextLogs: DeploymentLogEntry[] = [...existingLogs, nextLogEntry];

  await db.run(
    "UPDATE deployments SET status = ?, logs_json = ?, updated_at = ? WHERE id = ?",
    [status, serializeLogs(nextLogs), updatedAt, deploymentId],
  );

  return {
    ...deployment,
    status,
    updated_at: updatedAt,
    logs_json: serializeLogs(nextLogs),
  } satisfies Deployment;
}
