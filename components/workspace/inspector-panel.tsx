"use client";

import * as React from "react";
import {
  AlertCircle,
  Box,
  Code,
  Copy,
  ExternalLink,
  Eye,
  LoaderCircle,
  Maximize2,
  Rocket,
  Save,
  Signal,
  Smartphone,
  Trash2,
  Wifi,
  Battery,
} from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type {
  Artifact,
  Deployment,
  DeploymentLogEntry,
  FileRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { CodeEditor } from "@/components/workspace/code-editor";

const fetchJson = async <T,>(url: string) =>
  readJsonResponse<T>(await fetch(url));

function parseDeploymentLogs(logsJson: string | null) {
  if (!logsJson) {
    return [] as DeploymentLogEntry[];
  }

  try {
    return JSON.parse(logsJson) as DeploymentLogEntry[];
  } catch {
    return [] as DeploymentLogEntry[];
  }
}

export function InspectorPanel() {
  const {
    currentFile,
    currentFileId,
    currentSessionId,
    refreshFiles,
    resolvedConfig,
  } = useWorkspace();
  const [activeTab, setActiveTab] = React.useState("code");
  const [codeContent, setCodeContent] = React.useState("");
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [artifactActionError, setArtifactActionError] = React.useState<string | null>(null);
  const [deploymentActionError, setDeploymentActionError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCreatingArtifact, setIsCreatingArtifact] = React.useState(false);
  const [deletingArtifactId, setDeletingArtifactId] = React.useState<string | null>(null);
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = React.useState<string | null>(null);
  const [selectedDeploymentId, setSelectedDeploymentId] = React.useState<string | null>(null);

  const {
    data: file,
    error: fileError,
    isLoading: isFileLoading,
    mutate: mutateFile,
  } = useSWR<FileRecord>(
    currentFileId ? `/api/files/${currentFileId}` : null,
    fetchJson,
    { revalidateOnFocus: false },
  );

  const {
    data: artifacts = [],
    error: artifactsError,
    isLoading: isArtifactsLoading,
    mutate: mutateArtifacts,
  } = useSWR<Artifact[]>(
    currentSessionId ? `/api/sessions/${currentSessionId}/artifacts` : null,
    fetchJson,
    { revalidateOnFocus: false },
  );

  const {
    data: deployments = [],
    error: deploymentsError,
    isLoading: isDeploymentsLoading,
    mutate: mutateDeployments,
  } = useSWR<Deployment[]>(
    currentSessionId ? `/api/sessions/${currentSessionId}/deployments` : null,
    fetchJson,
    { revalidateOnFocus: false },
  );

  React.useEffect(() => {
    if (file) {
      setCodeContent(file.content);
      setEditorError(null);
    } else if (!currentFileId) {
      setCodeContent("");
      setEditorError(null);
    }
  }, [file, currentFileId]);

  React.useEffect(() => {
    setSelectedArtifactId((previous) => {
      if (previous && artifacts.some((artifact) => artifact.id === previous)) {
        return previous;
      }

      return artifacts[0]?.id ?? null;
    });
  }, [artifacts]);

  React.useEffect(() => {
    setSelectedDeploymentId((previous) => {
      if (previous && deployments.some((deployment) => deployment.id === previous)) {
        return previous;
      }

      return deployments[0]?.id ?? null;
    });
  }, [deployments]);

  const hasUnsavedChanges = Boolean(file && codeContent !== file.content);
  const previewUrl = currentFileId
    ? `/api/preview/${currentFileId}${file?.updated_at ? `?updated=${encodeURIComponent(file.updated_at)}` : ""}`
    : null;
  const filePathPrefix = file?.path.includes("/")
    ? `${file.path.split("/").slice(0, -1).join("/")}/`
    : "/";
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null;
  const selectedDeployment =
    deployments.find((deployment) => deployment.id === selectedDeploymentId) ?? null;
  const codeFontSize = resolvedConfig?.effective.code_font_size ?? 13;

  const handleSave = async () => {
    if (!currentFileId || !file || !hasUnsavedChanges) {
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      const updatedFile = await readJsonResponse<FileRecord>(
        await fetch(`/api/files/${currentFileId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: codeContent }),
        }),
      );
      await mutateFile(updatedFile, false);
      await refreshFiles();
    } catch (error) {
      setEditorError(getClientErrorMessage(error, "Failed to save file."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!file) {
      return;
    }

    try {
      await navigator.clipboard.writeText(codeContent);
      setEditorError(null);
    } catch (error) {
      setEditorError(getClientErrorMessage(error, "Failed to copy file contents."));
    }
  };

  const handleOpenPreview = () => {
    if (!previewUrl) {
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const handleCreateArtifact = async () => {
    if (!currentSessionId || !file) {
      setArtifactActionError("Select a saved file to create an artifact snapshot.");
      return;
    }

    setIsCreatingArtifact(true);
    setArtifactActionError(null);

    try {
      const createdArtifact = await readJsonResponse<Artifact>(
        await fetch(`/api/sessions/${currentSessionId}/artifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${file.name} snapshot`,
            type: file.type || "snapshot",
            content: codeContent,
            metadata_json: JSON.stringify({
              file_id: file.id,
              path: file.path,
              source: "manual-snapshot",
            }),
          }),
        }),
      );
      await mutateArtifacts((currentArtifacts) => [createdArtifact, ...(currentArtifacts || [])], false);
      setSelectedArtifactId(createdArtifact.id);
    } catch (error) {
      setArtifactActionError(getClientErrorMessage(error, "Failed to create artifact."));
    } finally {
      setIsCreatingArtifact(false);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    setDeletingArtifactId(artifactId);
    setArtifactActionError(null);

    try {
      await readJsonResponse<{ success: true }>(
        await fetch(`/api/artifacts/${artifactId}`, {
          method: "DELETE",
        }),
      );
      await mutateArtifacts(
        (currentArtifacts) => (currentArtifacts || []).filter((artifact) => artifact.id !== artifactId),
        false,
      );
    } catch (error) {
      setArtifactActionError(getClientErrorMessage(error, "Failed to delete artifact."));
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const handleCreateDeployment = async () => {
    if (!currentSessionId) {
      setDeploymentActionError("Select a session to create a deployment record.");
      return;
    }

    setIsDeploying(true);
    setDeploymentActionError(null);

    try {
      const createdDeployment = await readJsonResponse<Deployment>(
        await fetch(`/api/sessions/${currentSessionId}/deployments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environment: resolvedConfig?.effective.deploy_target ?? "local-preview",
            summary: currentFile
              ? `Bundled ${currentFile.path} for local preview.`
              : "Created a session-scoped local deployment record.",
          }),
        }),
      );
      await mutateDeployments(
        (currentDeployments) => [createdDeployment, ...(currentDeployments || [])],
        false,
      );
      setSelectedDeploymentId(createdDeployment.id);
    } catch (error) {
      setDeploymentActionError(
        getClientErrorMessage(error, "Failed to create deployment record."),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border-l border-zinc-800 w-[400px] xl:w-[450px]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="h-14 border-b border-zinc-800 flex items-center px-2 shrink-0 bg-[#0a0a0c]">
          <TabsList className="bg-transparent h-9 p-0 gap-1 w-full justify-start overflow-x-auto no-scrollbar">
            <InspectorTab value="code" icon={Code}>Code</InspectorTab>
            <InspectorTab value="preview" icon={Eye}>Preview</InspectorTab>
            <InspectorTab value="mobile" icon={Smartphone}>Mobile</InspectorTab>
            <InspectorTab value="artifacts" icon={Box}>Artifacts</InspectorTab>
            <InspectorTab value="deploy" icon={Rocket}>Deploy</InspectorTab>
          </TabsList>
          <div className="flex items-center gap-1 ml-auto">
            {activeTab === "code" && currentFileId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges || !file}
              >
                <Save className={cn("w-3.5 h-3.5", isSaving && "animate-pulse text-yellow-500")} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
              onClick={handleOpenPreview}
              disabled={!previewUrl}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-[#0a0a0c] relative">
          <TabsContent value="code" className="h-full m-0 data-[state=active]:flex flex-col">
            {!currentFileId ? (
              <PanelMessage
                icon={Code}
                title="No file selected"
                description="Select a file from the explorer to inspect or edit its saved contents."
              />
            ) : fileError ? (
              <PanelMessage
                icon={AlertCircle}
                title="Unable to load file"
                description={getClientErrorMessage(fileError, "Failed to load file.")}
                tone="error"
              />
            ) : isFileLoading && !file ? (
              <PanelMessage
                icon={LoaderCircle}
                title="Loading file"
                description="Fetching the latest saved file contents from the local workspace database."
              />
            ) : file ? (
              <>
                <div className="h-9 bg-zinc-900/30 border-b border-zinc-800 flex items-center px-3 justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-500">{filePathPrefix}</span>
                    <span className="text-zinc-200 font-medium">{file.name}</span>
                    {hasUnsavedChanges && (
                      <Badge
                        variant="outline"
                        className="h-5 border-amber-700/50 bg-amber-950/40 text-[9px] font-mono text-amber-200"
                      >
                        Unsaved
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="h-5 text-[9px] border-zinc-700 text-zinc-500 font-mono"
                    >
                      {file.name.split(".").pop()?.toUpperCase() ?? file.type.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-500"
                      onClick={handleCopy}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {editorError && <ErrorBanner message={editorError} />}
                <CodeEditor
                  value={codeContent}
                  onChange={setCodeContent}
                  language={file.type}
                  fontSize={codeFontSize}
                />
              </>
            ) : (
              <PanelMessage
                icon={AlertCircle}
                title="File unavailable"
                description="The selected file is not currently available in the local workspace database."
                tone="error"
              />
            )}
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0 data-[state=active]:flex flex-col bg-white">
            {!previewUrl ? (
              <PanelMessage
                icon={Eye}
                title="No preview target"
                description="Select a file to open the offline preview for its last saved output."
              />
            ) : (
              <div className="flex h-full flex-col bg-white">
                <div className="h-9 shrink-0 border-b border-zinc-800 bg-zinc-900/95 px-3 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                  <span className="truncate">{currentFile?.path ?? file?.path ?? "Saved preview"}</span>
                  <Badge variant="outline" className="h-5 border-zinc-700 text-[9px] text-zinc-400">
                    Offline Preview
                  </Badge>
                </div>
                <iframe key={previewUrl} src={previewUrl} className="w-full h-full border-0" title="Preview" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="mobile" className="h-full m-0 data-[state=active]:flex flex-col items-center justify-center bg-zinc-900/50 p-4">
            {previewUrl ? (
              <div className="relative w-[280px] h-[560px] bg-black rounded-[40px] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-zinc-700/50">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-black rounded-b-xl z-20" />
                <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-6 pt-2 z-10 text-white mix-blend-difference">
                  <span className="text-[10px] font-medium">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <Signal className="w-3 h-3" />
                    <Wifi className="w-3 h-3" />
                    <Battery className="w-3 h-3" />
                  </div>
                </div>
                <div className="h-full w-full bg-white pt-8">
                  <iframe key={`${previewUrl}-mobile`} src={previewUrl} className="w-full h-full border-0" title="Mobile Preview" />
                </div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-zinc-100/20 rounded-full z-20" />
              </div>
            ) : (
              <PanelMessage
                icon={Smartphone}
                title="No mobile preview target"
                description="Select a file to inspect its last saved output in the responsive mobile frame."
              />
            )}
          </TabsContent>

          <TabsContent value="artifacts" className="h-full m-0 data-[state=active]:flex flex-col bg-[#0a0a0c]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">Artifacts</p>
                <p className="text-[11px] text-zinc-500">Snapshots and write results for the current session.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                onClick={handleCreateArtifact}
                disabled={!currentSessionId || !file || isCreatingArtifact}
              >
                {isCreatingArtifact ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Box className="mr-2 h-3.5 w-3.5" />}
                {currentFile ? "Capture Snapshot" : "Select File"}
              </Button>
            </div>
            {artifactActionError && <ErrorBanner message={artifactActionError} />}
            {artifactsError && (
              <ErrorBanner message={getClientErrorMessage(artifactsError, "Failed to load artifacts.")} />
            )}
            {isArtifactsLoading && artifacts.length === 0 ? (
              <PanelMessage
                icon={LoaderCircle}
                title="Loading artifacts"
                description="Reading saved artifact records from the local workspace database."
              />
            ) : artifacts.length === 0 ? (
              <PanelMessage
                icon={Box}
                title="No artifacts yet"
                description="Create a snapshot or run a write-mode command to persist an artifact."
              />
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-[0.95fr_1.05fr]">
                <ScrollArea className="border-r border-zinc-800">
                  <div className="space-y-3 p-3">
                    {artifacts.map((artifact) => (
                      <button
                        key={artifact.id}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          artifact.id === selectedArtifactId
                            ? "border-zinc-700 bg-zinc-900"
                            : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/60",
                        )}
                        onClick={() => setSelectedArtifactId(artifact.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-100">{artifact.title}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="outline" className="h-5 border-zinc-700 text-[9px] text-zinc-400 font-mono">
                                {artifact.type}
                              </Badge>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {new Date(artifact.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteArtifact(artifact.id);
                            }}
                            disabled={deletingArtifactId === artifact.id}
                          >
                            {deletingArtifactId === artifact.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <ScrollArea className="flex-1">
                  {selectedArtifact ? (
                    <div className="space-y-4 p-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{selectedArtifact.title}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {new Date(selectedArtifact.created_at).toLocaleString()}
                        </p>
                      </div>
                      <pre className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words">
                        {selectedArtifact.content}
                      </pre>
                    </div>
                  ) : (
                    <PanelMessage
                      icon={Box}
                      title="Select an artifact"
                      description="Choose an artifact from the list to inspect its contents."
                    />
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="deploy" className="h-full m-0 data-[state=active]:flex flex-col bg-[#0a0a0c]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">Deploy</p>
                <p className="text-[11px] text-zinc-500">Local pseudo-deploy history with stored logs and targets.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                onClick={handleCreateDeployment}
                disabled={!currentSessionId || isDeploying}
              >
                {isDeploying ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-2 h-3.5 w-3.5" />}
                Record Deploy
              </Button>
            </div>
            {deploymentActionError && <ErrorBanner message={deploymentActionError} />}
            {deploymentsError && (
              <ErrorBanner message={getClientErrorMessage(deploymentsError, "Failed to load deployments.")} />
            )}
            {isDeploymentsLoading && deployments.length === 0 ? (
              <PanelMessage
                icon={LoaderCircle}
                title="Loading deployments"
                description="Reading local deployment records and logs."
              />
            ) : deployments.length === 0 ? (
              <PanelMessage
                icon={Rocket}
                title="No deploy records yet"
                description="Create a local deploy record to track pseudo-deploy activity for this session."
              />
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-[0.95fr_1.05fr]">
                <ScrollArea className="border-r border-zinc-800">
                  <div className="space-y-3 p-3">
                    {deployments.map((deployment) => (
                      <button
                        key={deployment.id}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          deployment.id === selectedDeploymentId
                            ? "border-zinc-700 bg-zinc-900"
                            : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/60",
                        )}
                        onClick={() => setSelectedDeploymentId(deployment.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{deployment.environment}</p>
                            <p className="mt-1 text-[10px] font-mono text-zinc-500">
                              {new Date(deployment.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 text-[9px] font-mono",
                              deployment.status === "success" &&
                                "border-emerald-700/50 bg-emerald-950/30 text-emerald-200",
                              deployment.status === "pending" &&
                                "border-amber-700/50 bg-amber-950/30 text-amber-200",
                              deployment.status === "failed" &&
                                "border-red-700/50 bg-red-950/30 text-red-200",
                            )}
                          >
                            {deployment.status}
                          </Badge>
                        </div>
                        {deployment.summary && (
                          <p className="mt-2 text-[11px] text-zinc-400">{deployment.summary}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <ScrollArea className="flex-1">
                  {selectedDeployment ? (
                    <div className="space-y-4 p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">{selectedDeployment.environment}</p>
                          <Badge variant="outline" className="border-zinc-700 text-[9px] text-zinc-400">
                            {selectedDeployment.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-zinc-500">{selectedDeployment.summary}</p>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-300">
                          {selectedDeployment.url ? (
                            <a
                              href={selectedDeployment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-zinc-200 hover:text-white"
                            >
                              {selectedDeployment.url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-500">Local record only</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Logs</p>
                        <div className="space-y-2">
                          {parseDeploymentLogs(selectedDeployment.logs_json).map((log) => (
                            <div key={log.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-300">
                              <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-500">
                                <span>{log.level}</span>
                                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                              <p className="mt-1">{log.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PanelMessage
                      icon={Rocket}
                      title="Select a deploy record"
                      description="Choose a deploy entry to inspect local logs and target information."
                    />
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function InspectorTab({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-100 text-zinc-500 hover:text-zinc-300 px-3 py-1.5 h-8 text-xs gap-2 border border-transparent data-[state=active]:border-zinc-800 rounded-md transition-all"
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </TabsTrigger>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function PanelMessage({
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Icon className={cn("h-8 w-8", tone === "error" ? "text-red-300/70" : "text-zinc-500/60")} />
      <p className={cn("text-sm font-medium", tone === "error" ? "text-red-100" : "text-zinc-300")}>
        {title}
      </p>
      <p className={cn("max-w-xs text-xs", tone === "error" ? "text-red-200/80" : "text-zinc-500")}>
        {description}
      </p>
    </div>
  );
}
