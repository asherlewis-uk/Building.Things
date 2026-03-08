"use client";

import * as React from "react";
import { Terminal, AlertCircle, Activity, X, CheckCircle2 } from "lucide-react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { TerminalOutputLine, TerminalResponse } from "@/lib/types";

type TerminalEntry = {
  id: string;
  type: "command" | TerminalOutputLine["type"];
  text: string;
};

function buildWelcomeEntries(): TerminalEntry[] {
  return [
    {
      id: "welcome-1",
      type: "info",
      text: "Welcome to the local IDE terminal.",
    },
    {
      id: "welcome-2",
      type: "info",
      text: "Type 'help' for available commands.",
    },
  ];
}

export function BottomRail() {
  const { currentSessionId } = useWorkspace();
  const [input, setInput] = React.useState("");
  const [historyBySession, setHistoryBySession] = React.useState<
    Record<string, TerminalEntry[]>
  >({
    global: buildWelcomeEntries(),
  });
  const [cwdBySession, setCwdBySession] = React.useState<
    Record<string, string>
  >({ global: "/" });
  const [isRunning, setIsRunning] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const sessionKey = currentSessionId ?? "global";
  const history = historyBySession[sessionKey] ?? buildWelcomeEntries();
  const cwd = cwdBySession[sessionKey] ?? "/";
  const problemCount = history.filter(
    (entry) => entry.type === "stderr",
  ).length;
  const outputEntries = history.filter((entry) => entry.type !== "command");

  React.useEffect(() => {
    setHistoryBySession((previousState) => {
      if (previousState[sessionKey]) {
        return previousState;
      }

      return {
        ...previousState,
        [sessionKey]: buildWelcomeEntries(),
      };
    });
    setCwdBySession((previousState) => {
      if (previousState[sessionKey]) {
        return previousState;
      }

      return {
        ...previousState,
        [sessionKey]: "/",
      };
    });
    setInput("");
    setRequestError(null);
  }, [sessionKey]);

  const handleCommand = async (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !input.trim() || isRunning) {
      return;
    }

    const command = input.trim();
    const commandEntry: TerminalEntry = {
      id: `${Date.now()}-command`,
      type: "command",
      text: `${cwd} $ ${command}`,
    };

    setHistoryBySession((previousState) => ({
      ...previousState,
      [sessionKey]: [
        ...(previousState[sessionKey] ?? buildWelcomeEntries()),
        commandEntry,
      ],
    }));
    setInput("");
    setIsRunning(true);
    setRequestError(null);

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, cwd, sessionId: currentSessionId }),
      });
      const data = await readJsonResponse<TerminalResponse>(res);

      const nextEntries = data.lines.map<TerminalEntry>((line, index) => ({
        id: `${Date.now()}-${index}`,
        type: line.type,
        text: line.text,
      }));

      setHistoryBySession((previousState) => ({
        ...previousState,
        [sessionKey]: data.cleared
          ? nextEntries
          : [...(previousState[sessionKey] ?? []), ...nextEntries],
      }));
      setCwdBySession((previousState) => ({
        ...previousState,
        [sessionKey]: data.cwd,
      }));
    } catch (error) {
      const message = getClientErrorMessage(
        error,
        "Failed to execute command.",
      );
      setRequestError(message);
      setHistoryBySession((previousState) => ({
        ...previousState,
        [sessionKey]: [
          ...(previousState[sessionKey] ?? []),
          {
            id: `${Date.now()}-stderr`,
            type: "stderr",
            text: message,
          },
        ],
      }));
    } finally {
      setIsRunning(false);
    }
  };

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [history]);

  return (
    <div className="h-[200px] border-t border-zinc-800 bg-[#0a0a0c] flex flex-col">
      <Tabs defaultValue="terminal" className="flex flex-col h-full">
        <div className="h-9 border-b border-zinc-800 flex items-center px-2 shrink-0 bg-[#0a0a0c]">
          <TabsList className="bg-transparent h-7 p-0 gap-4">
            <TabTrigger value="terminal" icon={Terminal} label="Terminal" />
            <TabTrigger value="output" icon={Activity} label="Output" />
            <TabTrigger
              value="problems"
              icon={AlertCircle}
              label="Problems"
              count={problemCount}
            />
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="text-zinc-500 hover:text-zinc-300"
              onClick={() =>
                setHistoryBySession((previousState) => ({
                  ...previousState,
                  [sessionKey]: [],
                }))
              }
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <TabsContent value="terminal" className="flex-1 m-0 p-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3 font-mono text-xs text-zinc-400 leading-relaxed">
              {requestError && (
                <div className="mb-2 flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={
                    entry.type === "command"
                      ? "whitespace-pre-wrap text-zinc-300"
                      : entry.type === "stderr"
                        ? "whitespace-pre-wrap text-red-300"
                        : entry.type === "info"
                          ? "whitespace-pre-wrap text-zinc-500"
                          : "whitespace-pre-wrap text-zinc-400"
                  }
                >
                  {entry.text}
                </div>
              ))}
              <div className="mt-1 flex gap-2 items-center">
                <span className="text-emerald-500">➜</span>
                <span className="text-blue-400">{cwd}</span>
                <input
                  className="bg-transparent outline-none text-zinc-300 flex-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleCommand}
                  autoFocus
                  disabled={isRunning}
                />
              </div>
              <div ref={endRef} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="output" className="flex-1 m-0 p-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 text-xs font-mono space-y-2">
              {outputEntries.length === 0 ? (
                <div className="text-zinc-500">No terminal output yet.</div>
              ) : (
                outputEntries.map((entry) => (
                  <div
                    key={`output-${entry.id}`}
                    className={
                      entry.type === "stderr"
                        ? "whitespace-pre-wrap text-red-300"
                        : entry.type === "info"
                          ? "whitespace-pre-wrap text-zinc-500"
                          : "whitespace-pre-wrap text-zinc-300"
                    }
                  >
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="problems" className="flex-1 m-0 p-0 min-h-0">
          {problemCount === 0 ? (
            <div className="p-4 text-xs text-zinc-500 font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              No terminal problems detected.
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 text-xs font-mono space-y-2">
                {history
                  .filter((entry) => entry.type === "stderr")
                  .map((entry) => (
                    <div
                      key={`problem-${entry.id}`}
                      className="whitespace-pre-wrap text-red-300"
                    >
                      {entry.text}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type TabTriggerProps = {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
};

function TabTrigger({ value, icon: Icon, label, count }: TabTriggerProps) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:text-zinc-100 text-zinc-500 hover:text-zinc-300 px-0 py-1 h-auto text-xs gap-1.5 border-b-2 border-transparent data-[state=active]:border-[#F6FF00] rounded-none transition-all font-mono"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count !== undefined && (
        <span className="ml-1 px-1 rounded-full bg-zinc-800 text-[9px]">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}
