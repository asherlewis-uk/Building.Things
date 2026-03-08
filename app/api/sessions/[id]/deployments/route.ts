import { NextResponse } from "next/server";
import { parseRequestJson, toErrorResponse } from "@/lib/api";
import {
  createPseudoDeployment,
  listDeployments,
} from "@/lib/services/deployments";

type SessionRouteContext = {
  params: Promise<{ id: string }>;
};

type CreateDeploymentBody = {
  environment?: unknown;
  url?: unknown;
  summary?: unknown;
};

export async function GET(_req: Request, { params }: SessionRouteContext) {
  try {
    const { id } = await params;
    const deployments = await listDeployments(id);
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

    const deployment = await createPseudoDeployment({
      session_id: id,
      environment: parsedBody.data.environment,
      url: parsedBody.data.url,
      summary: parsedBody.data.summary,
    });

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create deployment");
  }
}
