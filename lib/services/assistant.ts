import { v4 as uuidv4 } from "uuid";
import type {
  AssistantAffectedFile,
  AssistantEvent,
  AssistantPlanStep,
  AssistantWriteResult,
  FileRecord,
  Session,
  StoredMessageMetadata,
} from "@/lib/types";
import { createTextStream } from "@/lib/ai-stub";
import { createArtifact } from "@/lib/services/artifacts";
import { createFile, updateFile } from "@/lib/services/files";

interface AssistantMessageInput {
  role: string;
  content: unknown;
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => stringifyContent(item))
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    if ("text" in content && typeof content.text === "string") {
      return content.text;
    }

    return JSON.stringify(content, null, 2);
  }

  return "";
}

function toneLead(style: string) {
  if (style === "concise") {
    return "I processed your request locally.";
  }

  if (style === "detailed") {
    return "I processed your request entirely inside the local workspace shell and prepared a fuller explanation of what happened.";
  }

  return "I processed your request locally inside the workspace shell.";
}

function extractLastPrompt(messages: AssistantMessageInput[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return stringifyContent(lastUserMessage?.content).trim();
}

function findFencedCodeBlock(prompt: string) {
  const match = prompt.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

function findExplicitPath(prompt: string) {
  const patterns = [
    /(?:create|update|append|rewrite|replace)\s+(?:file\s+)?([\w./-]+\.[\w-]+)/i,
    /(?:in|to|at)\s+([\w./-]+\.[\w-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function wantsCreate(prompt: string) {
  return /\b(create|add|new file|generate file)\b/i.test(prompt);
}

function wantsAppend(prompt: string) {
  return /\bappend\b/i.test(prompt);
}

function wantsUpdate(prompt: string) {
  return /\b(update|rewrite|replace|modify|edit)\b/i.test(prompt);
}

function makePlan(label: string, status: AssistantPlanStep["status"], details?: string): AssistantPlanStep {
  return {
    id: uuidv4(),
    label,
    status,
    details,
  };
}

function makeEvent(level: AssistantEvent["level"], label: string, details?: string): AssistantEvent {
  return {
    id: uuidv4(),
    level,
    label,
    details,
  };
}

function formatChatReply(prompt: string, responseStyle: string, session: Session) {
  const lines = [toneLead(responseStyle)];

  if (prompt) {
    lines.push(`Active session: ${session.title}`);
    lines.push(`Prompt:\n${prompt}`);
  } else {
    lines.push("Send a prompt to exercise the local assistant without any external model provider.");
  }

  lines.push(
    "This assistant is intentionally local-only in this build, so it can reason about your saved workspace state but will not call any remote model APIs.",
  );

  return lines.join("\n\n");
}

export async function buildChatAssistantReply(options: {
  messages: AssistantMessageInput[];
  session: Session;
  responseStyle: string;
}) {
  const prompt = extractLastPrompt(options.messages);
  const content = formatChatReply(prompt, options.responseStyle, options.session);

  return {
    content,
    metadata: {
      kind: "chat",
    } satisfies StoredMessageMetadata,
    stream: createTextStream(content),
  };
}

export async function executeWriteAssistant(options: {
  messages: AssistantMessageInput[];
  session: Session;
  currentFile: FileRecord | null;
  workspaceId: string;
  responseStyle: string;
  autoArtifactSnapshots: boolean;
}) {
  const prompt = extractLastPrompt(options.messages);
  const codeBlock = findFencedCodeBlock(prompt);
  const explicitPath = findExplicitPath(prompt);
  const targetPath = explicitPath ?? options.currentFile?.path ?? null;
  const plan: AssistantPlanStep[] = [];
  const events: AssistantEvent[] = [];
  const affectedFiles: AssistantAffectedFile[] = [];
  let applied = false;
  let artifactTitle: string | null = null;
  let summary = "No file changes were applied. I analyzed the request and returned a local execution plan.";

  plan.push(
    makePlan(
      "Interpret the write request against the local workspace",
      "completed",
      prompt || "No prompt content was supplied.",
    ),
  );

  if (!prompt) {
    plan.push(
      makePlan(
        "Await a concrete write request",
        "blocked",
        "Write mode needs a prompt to generate a plan or apply a local file change.",
      ),
    );
    events.push(
      makeEvent(
        "warning",
        "No prompt supplied",
        "Nothing was executed because the request was empty.",
      ),
    );
  } else if (wantsCreate(prompt) && targetPath && codeBlock) {
    const createdFile = await createFile({
      workspace_id: options.workspaceId,
      path: targetPath,
      content: codeBlock,
    });
    applied = true;
    summary = `Created ${createdFile.path} from the write request.`;
    plan.push(
      makePlan(
        `Create ${createdFile.path}`,
        "completed",
        "A new file was created locally using the fenced code block from the prompt.",
      ),
    );
    events.push(
      makeEvent(
        "success",
        `Created ${createdFile.path}`,
        "The file was persisted to the local workspace database.",
      ),
    );
    affectedFiles.push({
      id: createdFile.id,
      path: createdFile.path,
      action: "create",
      status: "applied",
    });
  } else if (wantsAppend(prompt) && options.currentFile && codeBlock) {
    const updatedFile = await updateFile(options.currentFile.id, {
      content: `${options.currentFile.content}${options.currentFile.content.endsWith("\n") ? "" : "\n"}${codeBlock}\n`,
    });
    applied = true;
    summary = `Appended new content to ${updatedFile.path}.`;
    plan.push(
      makePlan(
        `Append content to ${updatedFile.path}`,
        "completed",
        "The fenced code block was appended to the currently selected file.",
      ),
    );
    events.push(
      makeEvent(
        "success",
        `Updated ${updatedFile.path}`,
        "The selected file now contains the appended content from the write request.",
      ),
    );
    affectedFiles.push({
      id: updatedFile.id,
      path: updatedFile.path,
      action: "append",
      status: "applied",
    });
  } else if (wantsUpdate(prompt) && options.currentFile && codeBlock) {
    const updatedFile = await updateFile(options.currentFile.id, {
      content: codeBlock,
    });
    applied = true;
    summary = `Replaced the contents of ${updatedFile.path} using the supplied code block.`;
    plan.push(
      makePlan(
        `Rewrite ${updatedFile.path}`,
        "completed",
        "The selected file was overwritten with the fenced code block from the prompt.",
      ),
    );
    events.push(
      makeEvent(
        "success",
        `Rewrote ${updatedFile.path}`,
        "The file was updated locally and is ready for inspection in the code panel.",
      ),
    );
    affectedFiles.push({
      id: updatedFile.id,
      path: updatedFile.path,
      action: "update",
      status: "applied",
    });
  } else {
    plan.push(
      makePlan(
        targetPath ? `Inspect ${targetPath}` : "Inspect current workspace state",
        "completed",
        "The request was interpreted and converted into a structured execution summary without mutating files.",
      ),
    );
    plan.push(
      makePlan(
        "Await an explicit file mutation command with a fenced code block",
        "pending",
        "To apply a file change in write mode, ask to create, replace, or append content and include a fenced code block.",
      ),
    );
    events.push(
      makeEvent(
        "info",
        "No file mutation applied",
        "The request did not contain a safe local mutation pattern that the assistant can execute without an external model.",
      ),
    );
    affectedFiles.push({
      id: options.currentFile?.id ?? null,
      path: targetPath ?? "workspace",
      action: targetPath ? "inspect" : "none",
      status: "planned",
    });
  }

  if (options.autoArtifactSnapshots) {
    const artifact = await createArtifact({
      session_id: options.session.id,
      title: `${options.session.title} write run`,
      type: applied ? "write-run" : "write-plan",
      content: JSON.stringify(
        {
          prompt,
          applied,
          summary,
          affected_files: affectedFiles,
        },
        null,
        2,
      ),
      metadata_json: JSON.stringify({
        source: "assistant",
        applied,
      }),
    });
    artifactTitle = artifact.title;
    events.push(
      makeEvent(
        "success",
        `Stored artifact ${artifact.title}`,
        "The write result was persisted as a local artifact snapshot.",
      ),
    );
  }

  const writeResult: AssistantWriteResult = {
    summary,
    applied,
    artifact_title: artifactTitle,
    plan,
    events,
    affected_files: affectedFiles,
  };
  const content = `${toneLead(options.responseStyle)}\n\n${summary}`;

  return {
    content,
    metadata: {
      kind: "write_result",
      write_result: writeResult,
    } satisfies StoredMessageMetadata,
    writeResult,
    stream: createTextStream(content),
  };
}
