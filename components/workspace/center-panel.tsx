"use client";

import * as React from "react";
import {
  AlertCircle,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Globe,
  Smartphone,
  ArrowRight,
  MoreHorizontal,
  Share,
  GitBranch,
  FileCode,
} from "lucide-react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import useSWR from "swr";
import type { Message } from "@/lib/types";

const fetchMessages = async (url: string) =>
  readJsonResponse<Message[]>(await fetch(url));

export function CenterPanel() {
  const { mode, setMode, currentSessionId } = useWorkspace();
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [panelError, setPanelError] = React.useState<string | null>(null);
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
  }, [currentSessionId]);

  const handleSend = async () => {
    const userMessage = input.trim();

    if (!userMessage || !currentSessionId || isSending) return;

    setIsSending(true);
    setPanelError(null);
    setInput("");

    const sessionId = currentSessionId;
    const tempId = Date.now().toString();
    const aiTempId = (Date.now() + 1).toString();
    const optimisticUserMsg: Message = {
      id: tempId,
      session_id: sessionId,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    const optimisticAiMsg: Message = {
      id: aiTempId,
      session_id: sessionId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    try {
      // Optimistic update
      await mutate(async (currentMessages) => {
        return [...(currentMessages || []), optimisticUserMsg, optimisticAiMsg];
      }, false);

      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage, role: "user" }),
      });

      if (!res.ok) {
        await readJsonResponse<unknown>(res);
      }

      const reader = res.body?.getReader();

      if (!reader) {
        throw new Error("The local stub did not return a readable response.");
      }

      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        aiContent += text;

        await mutate(async (currentMessages) => {
          return (currentMessages || []).map((message) =>
            message.id === aiTempId
              ? { ...message, content: aiContent }
              : message,
          );
        }, false);
      }

      await mutate();
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

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] relative">
      {/* Top Control Bar */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-[#0a0a0c]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setMode("write")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                mode === "write"
                  ? "bg-[#1E1F23] text-[#F6FF00] shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              Write
            </button>
            <button
              onClick={() => setMode("chat")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                mode === "chat"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              Chat
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-mono text-zinc-600">Model:</span>
            <span className="font-mono">Local Stub</span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 font-medium text-sm text-zinc-300 hidden md:block">
          {currentSessionId ? "Active Session" : "Select a Session"}
        </div>

        <div className="flex items-center gap-3">
          {isSending && (
            <Badge
              variant="outline"
              className="bg-zinc-900 border-zinc-800 text-zinc-400 font-mono text-[10px] gap-1.5 h-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Responding
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500">
            <Share className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Flow Awareness Ribbon */}
      <div className="h-8 border-b border-zinc-800/50 bg-zinc-900/20 flex items-center px-4 gap-4 overflow-hidden shrink-0">
        <span className="text-[10px] font-mono uppercase text-zinc-600 font-semibold tracking-wider shrink-0">
          AI Aware of:
        </span>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <ContextChip icon={GitBranch} label="Chat History" />
          {currentSessionId && (
            <ContextChip icon={FileCode} label="Session Context" />
          )}
        </div>
      </div>

      {/* AI Thread */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
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

          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserMessage key={msg.id} text={msg.content} />
            ) : (
              <AssistantMessage key={msg.id}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </AssistantMessage>
            ),
          )}

          {messages.length === 0 &&
            currentSessionId &&
            !isLoading &&
            !messagesError && (
              <div className="text-center text-zinc-500 mt-20">
                Start the conversation...
              </div>
            )}

          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Input Composer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c] to-transparent">
        <div className="max-w-3xl mx-auto bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Composer Top Strip */}
          <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-800/50 bg-zinc-900/30">
            <div className="flex items-center gap-2">
              <Badge variant="brand" className="h-4 px-1 text-[9px] font-bold">
                {mode.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">
                Local Stub
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Globe className="w-3 h-3" />
                <span>Web</span>
              </div>
              <div className="h-3 w-[1px] bg-zinc-800" />
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Smartphone className="w-3 h-3" />
                <span>Mobile</span>
              </div>
            </div>
          </div>

          <Textarea
            placeholder="Describe what to build, refactor, fix, or generate..."
            className="min-h-[100px] border-0 bg-transparent resize-none focus-visible:ring-0 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 font-sans"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="flex items-center justify-between p-2 bg-zinc-900/50">
            <div className="flex items-center gap-1">
              <IconButton icon={Paperclip} />
              <IconButton icon={ImageIcon} />
              <IconButton icon={Mic} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 bg-[#F6FF00] text-black hover:bg-[#F6FF00]/90 font-medium text-xs px-3"
                onClick={handleSend}
                disabled={isSending || !currentSessionId || !input.trim()}
              >
                {isSending ? "Running..." : "Run"}{" "}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ContextChipProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

function ContextChip({ icon: Icon, label }: ContextChipProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800/50 shrink-0">
      <Icon className="w-3 h-3 text-zinc-500" />
      <span className="text-[10px] text-zinc-400 font-mono">{label}</span>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 space-y-2 text-sm text-zinc-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

type IconButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
};

function IconButton({ icon: Icon }: IconButtonProps) {
  return (
    <button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );
}
