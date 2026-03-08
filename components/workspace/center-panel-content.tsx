"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  FileCode,
  Globe,
  Link2,
  Mic,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  Smartphone,
} from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { Message, StoredMessageMetadata } from "@/lib/types";

const fetchMessages = async (url: string) =>
  readJsonResponse<Message[]>(await fetch(url));

function parseMetadata(value: string | null): StoredMessageMetadata | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredMessageMetadata;
  } catch {
    return null;
  }
}

function buildShareUrl(currentOrigin: string, params: URLSearchParams) {
  const url = new URL(currentOrigin);
  url.search = params.toString();
  return url.toString();
}

export function CenterPanel() {
  const {
    currentFile,
    currentSession,
    currentSessionId,
    currentWorkspace,
    currentWorkspaceId,
    mode,
    refreshFiles,
    refreshSessions,
    resolvedConfig,
    setMode,
    setSettingsOpen,
  } = useWorkspace();
  const { mutate: mutateCache } = useSWRConfig();
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [panelError, setPanelError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const activeSessionRef = React.useRef<string | null>(currentSessionId);

  const {
    data: messages = [],
    error: messagesError,
    isLoading,
    mutate,
  } = useSWR<Message[]>(
    currentSessionId ? `/api/sessions/${currentSessionId}/messages` : null,
    fetchMessages,
    { revalidateOnFocus: false },
  );

  React.useEffect(() => {
    activeSessionRef.current = currentSessionId;
    setInput("");
    setPanelError(null);
    setNotice(null);
  }, [currentSessionId]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  const handleShare = async () => {
    try {
      const searchParams = new URLSearchParams();

      if (currentWorkspaceId) {
        searchParams.set("workspace", currentWorkspaceId);
      }

      if (currentSessionId) {
        searchParams.set("session", currentSessionId);
      }

      if (currentFile?.id) {
        searchParams.set("file", currentFile.id);
      }

      const origin =
        resolvedConfig?.env.app_url_valid && resolvedConfig.env.app_url
          ? resolvedConfig.env.app_url
          : window.location.origin;
      const url = buildShareUrl(origin, searchParams);
      await navigator.clipboard.writeText(url);
      setNotice("Workspace link copied to the clipboard.");
      setPanelError(null);
    } catch (error) {
      setPanelError(getClientErrorMessage(error, "Failed to copy share link."));
    }
  };

  const handleSend = async () => {
    const userMessage = input.trim();

    if (!userMessage || !currentSessionId || isSending) {
      return;
    }

    setIsSending(true);
    setPanelError(null);
    setNotice(null);
    setInput("");

    const sessionId = currentSessionId;
    const temporaryUserId = `${Date.now()}-user`;
    const temporaryAssistantId = `${Date.now()}-assistant`;
    const now = new Date().toISOString();
    const optimisticUserMessage: Message = {
      id: temporaryUserId,
      session_id: sessionId,
      role: "user",
      content: userMessage,
      mode,
      metadata_json: null,
      created_at: now,
    };
    const optimisticAssistantMessage: Message = {
      id: temporaryAssistantId,
      session_id: sessionId,
      role: "assistant",
      content: "",
      mode,
      metadata_json: null,
      created_at: now,
    };

    try {
      await mutate(
        async (currentMessages) => [
          ...(currentMessages || []),
          optimisticUserMessage,
          optimisticAssistantMessage,
        ],
        false,
      );

      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userMessage,
          role: "user",
          mode,
          current_file_id: mode === "write" ? (currentFile?.id ?? null) : null,
        }),
      });

      if (!response.ok) {
        await readJsonResponse<unknown>(response);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error(
          "The local assistant did not return a readable response.",
        );
      }

      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        assistantContent += decoder.decode(value, { stream: true });
        await mutate(
          async (currentMessages) =>
            (currentMessages || []).map((message) =>
              message.id === temporaryAssistantId
                ? { ...message, content: assistantContent }
                : message,
            ),
          false,
        );
      }

      await mutate();
      if (mode === "write") {
        await Promise.all([
          refreshSessions(),
          refreshFiles(),
          mutateCache(`/api/sessions/${sessionId}/artifacts`),
          currentFile?.id
            ? mutateCache(`/api/files/${currentFile.id}`)
            : Promise.resolve(undefined),
        ]);
      }
      setNotice(mode === "write" ? "Write execution completed." : null);
    } catch (error) {
      await mutate();
      if (activeSessionRef.current === sessionId) {
        setInput(userMessage);
        setPanelError(getClientErrorMessage(error, "Failed to send message."));
      }
    } finally {
      setIsSending(false);
    }
  };

  const modeDescription =
    mode === "write"
      ? "Operational write mode persists structured execution results and can apply safe local file changes."
      : "Chat mode keeps the assistant conversational and never mutates files directly.";
  const placeholder =
    mode === "write"
      ? "Describe a local workspace task. To create or rewrite a file, include a fenced code block and say create, replace, or append."
      : "Ask about the current workspace, architecture, or next steps...";

  return (
    <div className="flex h-full flex-col bg-[#0a0a0c] relative">
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-[#0a0a0c]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => void setMode("write")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mode === "write"
                  ? "bg-[#1E1F23] text-[#F6FF00] shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Write
            </button>
            <button
              onClick={() => void setMode("chat")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mode === "chat"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Chat
            </button>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-mono text-zinc-600">Workspace:</span>
            <span className="font-mono">
              {currentWorkspace?.name ?? "None"}
            </span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 font-medium text-sm text-zinc-300 hidden md:block truncate max-w-[320px]">
          {currentSession?.title ?? "Select a Session"}
        </div>

        <div className="flex items-center gap-3">
          {isSending && (
            <Badge
              variant="outline"
              className="bg-zinc-900 border-zinc-800 text-zinc-400 font-mono text-[10px] gap-1.5 h-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {mode === "write" ? "Executing" : "Responding"}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500"
            onClick={handleShare}
          >
            <Link2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500"
            onClick={() => setSettingsOpen(true)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="h-8 border-b border-zinc-800/50 bg-zinc-900/20 flex items-center px-4 gap-4 overflow-hidden shrink-0">
        <span className="text-[10px] font-mono uppercase text-zinc-600 font-semibold tracking-wider shrink-0">
          Mode Context
        </span>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar text-[10px] font-mono text-zinc-400">
          <ContextChip
            icon={Sparkles}
            label={
              mode === "write" ? "Structured execution" : "Conversation history"
            }
          />
          {currentSession && (
            <ContextChip icon={Globe} label={currentSession.mode} />
          )}
          {currentFile && (
            <ContextChip icon={FileCode} label={currentFile.path} />
          )}
        </div>
      </div>

      <div className="border-b border-zinc-800/50 bg-zinc-950/40 px-4 py-2 text-[11px] text-zinc-500">
        {modeDescription}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
          {(panelError || messagesError || notice) && (
            <div className="space-y-2">
              {(panelError || messagesError) && (
                <div className="flex items-start gap-2 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {panelError ??
                      getClientErrorMessage(
                        messagesError,
                        "Failed to load messages.",
                      )}
                  </span>
                </div>
              )}
              {notice && (
                <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                  {notice}
                </div>
              )}
            </div>
          )}

          {!currentSessionId && (
            <div className="text-center text-zinc-500 mt-20">
              Select or create a session to start.
            </div>
          )}

          {currentSessionId &&
            isLoading &&
            messages.length === 0 &&
            !messagesError && (
              <div className="text-center text-zinc-500 mt-20">
                Loading conversation…
              </div>
            )}

          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage
                key={message.id}
                mode={message.mode}
                text={message.content}
              />
            ) : (
              <AssistantMessage
                key={message.id}
                mode={message.mode}
                message={message}
              />
            ),
          )}

          {messages.length === 0 &&
            currentSessionId &&
            !isLoading &&
            !messagesError && (
              <div className="text-center text-zinc-500 mt-20">
                {mode === "write"
                  ? "Describe the local change you want to execute."
                  : "Start the conversation..."}
              </div>
            )}

          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c] to-transparent">
        <div className="max-w-3xl mx-auto bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-800/50 bg-zinc-900/30">
            <div className="flex items-center gap-2">
              <Badge variant="brand" className="h-4 px-1 text-[9px] font-bold">
                {mode.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">
                {mode === "write" ? "Local executor" : "Local assistant"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Globe className="w-3 h-3" />
                <span>{currentWorkspace?.name ?? "No workspace"}</span>
              </div>
              {currentFile && (
                <>
                  <div className="h-3 w-[1px] bg-zinc-800" />
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Smartphone className="w-3 h-3" />
                    <span>{currentFile.name}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <Textarea
            placeholder={placeholder}
            className="min-h-[110px] border-0 bg-transparent resize-none focus-visible:ring-0 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 font-sans"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />

          <div className="flex items-center justify-between p-2 bg-zinc-900/50">
            <div className="flex items-center gap-1">
              <DisabledIconButton
                icon={Paperclip}
                label="Attachments are unavailable in this local build."
              />
              <DisabledIconButton
                icon={Sparkles}
                label="Generated media is unavailable in this local build."
              />
              <DisabledIconButton
                icon={Mic}
                label="Voice input is unavailable in this local build."
              />
            </div>
            <div className="flex items-center gap-2">
              {mode === "write" && currentFile && (
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-mono text-zinc-500">
                  targeting {currentFile.name}
                </span>
              )}
              <Button
                size="sm"
                className="h-7 bg-[#F6FF00] text-black hover:bg-[#F6FF00]/90 font-medium text-xs px-3"
                onClick={() => void handleSend()}
                disabled={isSending || !currentSessionId || !input.trim()}
              >
                {isSending
                  ? mode === "write"
                    ? "Running..."
                    : "Sending..."
                  : mode === "write"
                    ? "Run"
                    : "Send"}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800/50 shrink-0">
      <Icon className="w-3 h-3 text-zinc-500" />
      <span className="text-[10px] text-zinc-400 font-mono">{label}</span>
    </div>
  );
}

function UserMessage({ text, mode }: { text: string; mode: Message["mode"] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-zinc-700/50 bg-zinc-800/50 px-4 py-3 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <Badge
            variant="outline"
            className="h-4 border-zinc-700 text-[9px] text-zinc-500"
          >
            {mode}
          </Badge>
          <span>You</span>
        </div>
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  mode,
}: {
  message: Message;
  mode: Message["mode"];
}) {
  const metadata = parseMetadata(message.metadata_json);
  const writeResult =
    metadata?.kind === "write_result" ? metadata.write_result : null;

  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 space-y-3 text-sm text-zinc-300 leading-relaxed">
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <Badge
            variant="outline"
            className="h-4 border-zinc-700 text-[9px] text-zinc-500"
          >
            {mode}
          </Badge>
          <span>Local assistant</span>
        </div>
        <div className="whitespace-pre-wrap">
          {message.content || "Working..."}
        </div>
        {writeResult && (
          <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-100">Write Result</p>
              <Badge
                variant="outline"
                className={
                  writeResult.applied
                    ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200"
                    : "border-amber-700/50 bg-amber-950/30 text-amber-200"
                }
              >
                {writeResult.applied ? "applied" : "planned"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-300">{writeResult.summary}</p>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard
                title="Plan"
                lines={writeResult.plan.map(
                  (step) => `${step.status}: ${step.label}`,
                )}
              />
              <InfoCard
                title="Affected Files"
                lines={writeResult.affected_files.map(
                  (file) => `${file.action}: ${file.path}`,
                )}
              />
              <InfoCard
                title="Events"
                lines={writeResult.events.map(
                  (event) => `${event.level}: ${event.label}`,
                )}
              />
            </div>
            {writeResult.artifact_title && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400">
                Artifact saved: {writeResult.artifact_title}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-2 space-y-2 text-[11px] text-zinc-300">
        {lines.length === 0 ? (
          <div className="text-zinc-500">None</div>
        ) : (
          lines.map((line) => <div key={line}>{line}</div>)
        )}
      </div>
    </div>
  );
}

function DisabledIconButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      className="rounded-md p-1.5 text-zinc-600 opacity-60"
      disabled
      title={label}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
