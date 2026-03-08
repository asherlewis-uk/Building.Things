import { NextResponse } from "next/server";
import {
  ApiRouteError,
  parseRequestJson,
  toErrorResponse,
  trimString,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Deployment } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateDeploymentBody = {
  environment?: unknown;
  status?: unknown;
  url?: unknown;
};

async function assertSessionExists(sessionId: string) {
  const db = await getDb();
  const session = await db.get<{ id: string }>(
    "SELECT id FROM sessions WHERE id = ?",
    [sessionId],
  );

  if (!session?.id) {
    throw new ApiRouteError("Session not found", 404);
  }

  return db;
}

function normalizeStatus(status: unknown): Deployment["status"] {
  return status === "pending" || status === "failed" ? status : "success";
}

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const db = await assertSessionExists(id);
    const deployments = await db.all<Deployment[]>(
      "SELECT * FROM deployments WHERE session_id = ? ORDER BY created_at DESC",
      [id],
    );
    return NextResponse.json(deployments);
  } catch (error) {
    return toErrorResponse(error, "Failed to load deployments");
  }
}

export async function POST(req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const parsedBody = await parseRequestJson<CreateDeploymentBody>(req);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const db = await assertSessionExists(id);
    const { environment, status, url } = parsedBody.data;
    const resolvedEnvironment = trimString(environment) ?? "local";
    const resolvedStatus = normalizeStatus(status);
    const resolvedUrl = trimString(url) ?? "http://localhost:3000";

    if (resolvedEnvironment.length > 60) {
      throw new ApiRouteError("Invalid deployment payload", 400, undefined, {
        environment: "Environment must be 60 characters or fewer.",
      });
    }

    const deployment: Deployment = {
      id: uuidv4(),
      session_id: id,
      environment: resolvedEnvironment,
      status: resolvedStatus,
      url: resolvedUrl,
      created_at: new Date().toISOString(),
    };

    await db.run(
      "INSERT INTO deployments (id, session_id, environment, status, url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        deployment.id,
        deployment.session_id,
        deployment.environment,
        deployment.status,
        deployment.url,
        deployment.created_at,
      ],
    );
    await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
      deployment.created_at,
      id,
    ]);

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create deployment");
  }
}
