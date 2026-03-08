"use client";

import * as React from "react";
import {
  AlertCircle,
  LoaderCircle,
  Code,
  Eye,
  Smartphone,
  Box,
  Rocket,
  Maximize2,
  Copy,
  Save,
  ExternalLink,
  Signal,
  Wifi,
  Battery,
  Trash2,
} from "lucide-react";
import { getClientErrorMessage, readJsonResponse } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import useSWR from "swr";
import type { Artifact, Deployment, FileRecord } from "@/lib/types";

const fetchJson = async <T,>(url: string) =>
  readJsonResponse<T>(await fetch(url));

export function RightPanel() {
  const { currentSessionId, currentFileId, currentFile, refreshFiles } =
    useWorkspace();
  const [activeTab, setActiveTab] = React.useState("code");
  const [codeContent, setCodeContent] = React.useState("");
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [artifactActionError, setArtifactActionError] = React.useState<
    string | null
  >(null);
  const [deploymentActionError, setDeploymentActionError] = React.useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCreatingArtifact, setIsCreatingArtifact] = React.useState(false);
  const [deletingArtifactId, setDeletingArtifactId] = React.useState<
    string | null
  >(null);
  const [isDeploying, setIsDeploying] = React.useState(false);

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

  const hasUnsavedChanges = Boolean(file && codeContent !== file.content);
  const previewUrl = currentFileId
    ? `/api/preview/${currentFileId}${file?.updated_at ? `?updated=${encodeURIComponent(file.updated_at)}` : ""}`
    : null;
  const filePathPrefix = file?.path.includes("/")
    ? `${file.path.split("/").slice(0, -1).join("/")}/`
    : "/";

  const handleSave = async () => {
    if (!currentFileId || !file || !hasUnsavedChanges) return;

    setIsSaving(true);
    setEditorError(null);
    try {
      const res = await fetch(`/api/files/${currentFileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: codeContent }),
      });
      const updatedFile = await readJsonResponse<FileRecord>(res);
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
      setEditorError(
        getClientErrorMessage(error, "Failed to copy file contents."),
      );
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
      setArtifactActionError(
        "Select a saved file to create an artifact snapshot.",
      );
      return;
    }

    setIsCreatingArtifact(true);
    setArtifactActionError(null);
    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${file.name} snapshot`,
          type: file.type || "snapshot",
          content: codeContent,
        }),
      });
      const createdArtifact = await readJsonResponse<Artifact>(res);
      await mutateArtifacts(
        (currentArtifacts) => [createdArtifact, ...(currentArtifacts || [])],
        false,
      );
    } catch (error) {
      setArtifactActionError(
        getClientErrorMessage(error, "Failed to create artifact."),
      );
    } finally {
      setIsCreatingArtifact(false);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    setDeletingArtifactId(artifactId);
    setArtifactActionError(null);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}`, {
        method: "DELETE",
      });
      await readJsonResponse<{ success: true }>(res);
      await mutateArtifacts(
        (currentArtifacts) =>
          (currentArtifacts || []).filter(
            (artifact) => artifact.id !== artifactId,
          ),
        false,
      );
    } catch (error) {
      setArtifactActionError(
        getClientErrorMessage(error, "Failed to delete artifact."),
      );
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const handleCreateDeployment = async () => {
    if (!currentSessionId) {
      setDeploymentActionError(
        "Select a session to create a deployment record.",
      );
      return;
    }

    setIsDeploying(true);
    setDeploymentActionError(null);
    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "local",
          status: "success",
          url: "http://localhost:3000",
        }),
      });
      const createdDeployment = await readJsonResponse<Deployment>(res);
      await mutateDeployments(
        (currentDeployments) => [
          createdDeployment,
          ...(currentDeployments || []),
        ],
        false,
      );
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
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="h-14 border-b border-zinc-800 flex items-center px-2 shrink-0 bg-[#0a0a0c]">
          <TabsList className="bg-transparent h-9 p-0 gap-1 w-full justify-start overflow-x-auto no-scrollbar">
            <TabTrigger value="code" icon={Code}>
              Code
            </TabTrigger>
            <TabTrigger value="preview" icon={Eye}>
              Preview
            </TabTrigger>
            <TabTrigger value="mobile" icon={Smartphone}>
              Mobile
            </TabTrigger>
            <TabTrigger value="artifacts" icon={Box}>
              Artifacts
            </TabTrigger>
            <TabTrigger value="deploy" icon={Rocket}>
              Deploy
            </TabTrigger>
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
                <Save
                  className={cn(
                    "w-3.5 h-3.5",
                    isSaving && "animate-pulse text-yellow-500",
                  )}
                />
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
          <TabsContent
            value="code"
            className="h-full m-0 data-[state=active]:flex flex-col"
          >
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
                description={getClientErrorMessage(
                  fileError,
                  "Failed to load file.",
                )}
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
                    <span className="text-zinc-200 font-medium">
                      {file.name}
                    </span>
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
                      {file.name.split(".").pop()?.toUpperCase() ??
                        file.type.toUpperCase()}
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
                <ScrollArea className="flex-1 bg-[#0a0a0c]">
                  <div className="p-4 font-mono text-xs leading-relaxed h-full">
                    <textarea
                      className="w-full h-full bg-transparent text-zinc-300 outline-none resize-none min-h-[calc(100vh-200px)] font-mono"
                      value={codeContent}
                      onChange={(e) => setCodeContent(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </ScrollArea>
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

          <TabsContent
            value="preview"
            className="h-full m-0 data-[state=active]:flex flex-col bg-white"
          >
            {!previewUrl ? (
              <PanelMessage
                icon={Eye}
                title="No preview target"
                description="Select a file to open the offline preview for its last saved output."
              />
            ) : (
              <div className="flex h-full flex-col bg-white">
                <div className="h-9 shrink-0 border-b border-zinc-800 bg-zinc-900/95 px-3 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                  <span className="truncate">
                    {currentFile?.path ?? file?.path ?? "Saved preview"}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 border-zinc-700 text-[9px] text-zinc-400"
                  >
                    Offline Preview
                  </Badge>
                </div>
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Preview"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="mobile"
            className="h-full m-0 data-[state=active]:flex flex-col items-center justify-center bg-zinc-900/50 p-4"
          >
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
                  <iframe
                    key={`${previewUrl}-mobile`}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Mobile Preview"
                  />
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

          <TabsContent value="artifacts" className="h-full m-0">
            <ArtifactsView
              currentSessionId={currentSessionId}
              currentFileName={file?.name ?? currentFile?.name ?? null}
              errorMessage={
                artifactActionError ??
                (artifactsError
                  ? getClientErrorMessage(
                      artifactsError,
                      "Failed to load artifacts.",
                    )
                  : null)
              }
              isCreatingArtifact={isCreatingArtifact}
              isDeletingArtifactId={deletingArtifactId}
              isLoading={isArtifactsLoading}
              artifacts={artifacts}
              canCreate={Boolean(currentSessionId && file)}
              onCreate={handleCreateArtifact}
              onDelete={handleDeleteArtifact}
            />
          </TabsContent>

          <TabsContent value="deploy" className="h-full m-0">
            <DeployView
              currentSessionId={currentSessionId}
              deployments={deployments}
              errorMessage={
                deploymentActionError ??
                (deploymentsError
                  ? getClientErrorMessage(
                      deploymentsError,
                      "Failed to load deployments.",
                    )
                  : null)
              }
              isLoading={isDeploymentsLoading}
              isDeploying={isDeploying}
              onCreate={handleCreateDeployment}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type TabTriggerProps = {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
};

function TabTrigger({ value, icon: Icon, children }: TabTriggerProps) {
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

type PanelMessageProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone?: "default" | "error";
};

function PanelMessage({
  icon: Icon,
  title,
  description,
  tone = "default",
}: PanelMessageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Icon
        className={cn(
          "h-8 w-8",
          tone === "error" ? "text-red-300/70" : "text-zinc-500/60",
        )}
      />
      <p
        className={cn(
          "text-sm font-medium",
          tone === "error" ? "text-red-100" : "text-zinc-300",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "max-w-xs text-xs",
          tone === "error" ? "text-red-200/80" : "text-zinc-500",
        )}
      >
        {description}
      </p>
    </div>
  );
}

type ArtifactsViewProps = {
  currentSessionId: string | null;
  currentFileName: string | null;
  errorMessage: string | null;
  isCreatingArtifact: boolean;
  isDeletingArtifactId: string | null;
  isLoading: boolean;
  artifacts: Artifact[];
  canCreate: boolean;
  onCreate: () => void;
  onDelete: (artifactId: string) => void;
};

function ArtifactsView({
  currentSessionId,
  currentFileName,
  errorMessage,
  isCreatingArtifact,
  isDeletingArtifactId,
  isLoading,
  artifacts,
  canCreate,
  onCreate,
  onDelete,
}: ArtifactsViewProps) {
  if (!currentSessionId) {
    return (
      <PanelMessage
        icon={Box}
        title="No active session"
        description="Select a session before capturing artifact snapshots for the local workspace."
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0c]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Artifacts</p>
          <p className="text-[11px] text-zinc-500">
            Create durable snapshots from the selected file.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          onClick={onCreate}
          disabled={!canCreate || isCreatingArtifact}
        >
          {isCreatingArtifact ? (
            <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Box className="mr-2 h-3.5 w-3.5" />
          )}
          {currentFileName ? "Create Snapshot" : "Select File"}
        </Button>
      </div>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      {isLoading && artifacts.length === 0 ? (
        <PanelMessage
          icon={LoaderCircle}
          title="Loading artifacts"
          description="Reading saved artifact records from the local workspace database."
        />
      ) : artifacts.length === 0 ? (
        <PanelMessage
          icon={Box}
          title="No artifacts yet"
          description={
            currentFileName
              ? `Create a snapshot for ${currentFileName} to store it as a reusable artifact.`
              : "Select a file and create a snapshot to store it as an artifact."
          }
        />
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-3">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {artifact.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="h-5 border-zinc-700 text-[9px] text-zinc-400 font-mono"
                      >
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
                    onClick={() => onDelete(artifact.id)}
                    disabled={isDeletingArtifactId === artifact.id}
                  >
                    {isDeletingArtifactId === artifact.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">
                  {artifact.content}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

type DeployViewProps = {
  currentSessionId: string | null;
  deployments: Deployment[];
  errorMessage: string | null;
  isLoading: boolean;
  isDeploying: boolean;
  onCreate: () => void;
};

function DeployView({
  currentSessionId,
  deployments,
  errorMessage,
  isLoading,
  isDeploying,
  onCreate,
}: DeployViewProps) {
  if (!currentSessionId) {
    return (
      <PanelMessage
        icon={Rocket}
        title="No active session"
        description="Select a session before recording local deployment runs for the workspace."
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0c]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Deploy</p>
          <p className="text-[11px] text-zinc-500">
            Record local pseudo-deploy runs without external infrastructure.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          onClick={onCreate}
          disabled={isDeploying}
        >
          {isDeploying ? (
            <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-3.5 w-3.5" />
          )}
          Create Deploy Record
        </Button>
      </div>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      {isLoading && deployments.length === 0 ? (
        <PanelMessage
          icon={LoaderCircle}
          title="Loading deployments"
          description="Reading saved deployment records from the local workspace database."
        />
      ) : deployments.length === 0 ? (
        <PanelMessage
          icon={Rocket}
          title="No deploy records yet"
          description="Create a local deploy record to track when this session was packaged or previewed."
        />
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {deployment.environment}
                    </p>
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
                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-300">
                  {deployment.url ? (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-zinc-200 hover:text-white"
                    >
                      {deployment.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-zinc-500">Local record only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
