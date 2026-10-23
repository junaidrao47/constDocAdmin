"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiError } from "@/lib/api";
import { allowedTransitions, useStatusContract } from "@/lib/documents";
import { messageForError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type {
  DocumentHistoryEntry,
  DocumentRecord,
  DocumentStatus,
  DocumentVersion,
  UserRole,
} from "@/lib/types";
import { uploadWithProgress } from "@/lib/upload";

const TRANSITION_LABEL: Record<DocumentStatus, string> = {
  pending: "Send back to pending",
  under_review: "Start review",
  approved: "Approve",
  submitted_to_government: "Mark submitted to government",
  rejected: "Reject",
  expiring_soon: "Mark expiring soon",
  expired: "Mark expired",
};

const KIND_LABEL: Record<string, string> = {
  customer: "Customer",
  staff_on_behalf: "Staff (on behalf)",
  official: "Official",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DocumentDrawerProps {
  document: DocumentRecord;
  customerLabel: string;
  serviceLabel: string;
  role: UserRole;
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDrawer({
  document,
  customerLabel,
  serviceLabel,
  role,
  token,
  open,
  onOpenChange,
}: DocumentDrawerProps) {
  const client = useQueryClient();
  const contract = useStatusContract();
  const [rejecting, setRejecting] = useState(false);

  const versions = useQuery({
    queryKey: ["document-versions", document.id],
    queryFn: () => apiRequest<DocumentVersion[]>(`/documents/${document.id}/versions`),
    enabled: open,
  });
  const history = useQuery({
    queryKey: ["document-history", document.id],
    queryFn: () => apiRequest<DocumentHistoryEntry[]>(`/documents/${document.id}/history`),
    enabled: open,
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["admin-documents"] });
    void client.invalidateQueries({ queryKey: ["document-versions", document.id] });
    void client.invalidateQueries({ queryKey: ["document-history", document.id] });
  };

  const transition = useMutation({
    mutationFn: ({ toStatus, note }: { toStatus: DocumentStatus; note?: string }) =>
      apiRequest(`/documents/${document.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ fromStatus: document.status, toStatus, note }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(`Document moved to ${variables.toStatus.replaceAll("_", " ")}.`);
      setRejecting(false);
      refresh();
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not update the status.")),
  });

  const nextStatuses = allowedTransitions(contract.data, role, document.status);

  async function openSignedUrl(versionId: string, mode: "download-url" | "preview-url") {
    try {
      const result = await apiRequest<{ downloadUrl: string }>(
        `/documents/${document.id}/versions/${versionId}/${mode}`,
      );
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(messageForError(error, "Could not open the file."));
    }
  }

  const sortedVersions = [...(versions.data ?? [])].sort((a, b) => a.versionNo - b.versionNo);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="truncate">{document.fileName}</span>
            <StatusBadge status={document.status} />
          </SheetTitle>
          <SheetDescription>
            {customerLabel} · {serviceLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4 pb-8">
          {/* Actions, driven by the statuses contract for this role. */}
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Actions</h3>
            {contract.isLoading && (
              <p className="text-sm text-muted-foreground">Loading available actions…</p>
            )}
            {!contract.isLoading && nextStatuses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No status change is available from {document.status.replaceAll("_", " ")}.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) =>
                status === "rejected" ? (
                  <Button
                    key={status}
                    variant="destructive"
                    disabled={transition.isPending}
                    onClick={() => setRejecting(true)}
                  >
                    {TRANSITION_LABEL[status]}
                  </Button>
                ) : (
                  <Button
                    key={status}
                    variant={status === "approved" ? "default" : "outline"}
                    disabled={transition.isPending}
                    onClick={() => transition.mutate({ toStatus: status })}
                  >
                    {TRANSITION_LABEL[status]}
                  </Button>
                ),
              )}
            </div>

            {rejecting && (
              <RejectForm
                pending={transition.isPending}
                error={transition.error}
                onCancel={() => setRejecting(false)}
                onSubmit={(note) => transition.mutate({ toStatus: "rejected", note })}
              />
            )}
          </section>

          {/* Uploads. */}
          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Upload</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadPanel
                title="On behalf of customer"
                description="Adds a customer version (document must be pending or rejected)."
                path={`/documents/${document.id}/upload`}
                token={token}
                onDone={refresh}
              />
              <UploadPanel
                title="Official file"
                description="The approved government file (document must be submitted to government)."
                path={`/documents/${document.id}/approved-upload`}
                token={token}
                onDone={refresh}
              />
            </div>
          </section>

          {/* Versions. */}
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Versions ({sortedVersions.length})</h3>
            {versions.isLoading && <p className="text-sm text-muted-foreground">Loading versions…</p>}
            {versions.isError && (
              <p role="alert" className="text-sm text-destructive">
                {messageForError(versions.error, "Could not load versions.")}
              </p>
            )}
            {versions.isSuccess && sortedVersions.length === 0 && (
              <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
            )}
            <ul className="grid gap-2">
              {sortedVersions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between gap-3 border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      v{version.versionNo} · {version.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[version.kind] ?? version.kind} · {formatBytes(version.sizeBytes)} ·{" "}
                      {formatDate(version.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Preview v${version.versionNo}`}
                      onClick={() => openSignedUrl(version.id, "preview-url")}
                    >
                      <Eye size={15} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Download v${version.versionNo}`}
                      onClick={() => openSignedUrl(version.id, "download-url")}
                    >
                      <Download size={15} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Timeline. */}
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Timeline</h3>
            {history.isLoading && <p className="text-sm text-muted-foreground">Loading timeline…</p>}
            {history.isError && (
              <p role="alert" className="text-sm text-destructive">
                {messageForError(history.error, "Could not load the timeline.")}
              </p>
            )}
            <ol className="grid gap-3 border-l border-border pl-4">
              {(history.data ?? []).map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {entry.fromStatus && <StatusBadge status={entry.fromStatus} />}
                    <span aria-hidden>→</span>
                    <StatusBadge status={entry.toStatus} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                    {entry.changedBy ? ` · ${entry.changedBy.name ?? entry.changedBy.email}` : ""}
                  </p>
                  {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const rejectSchema = z.object({
  note: z.string().trim().min(5, "A note of at least 5 characters is required").max(1000),
});
type RejectValues = z.infer<typeof rejectSchema>;

function RejectForm({
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const form = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { note: "" } });
  const serverError =
    error instanceof ApiError && error.code === "NOTE_REQUIRED" ? error.message : null;

  return (
    <form
      className="mt-2 grid gap-2 border border-border bg-muted/40 p-3"
      onSubmit={form.handleSubmit((values) => onSubmit(values.note))}
      noValidate
    >
      <label className="text-sm font-medium" htmlFor="reject-note">
        Reason for rejection
      </label>
      <Textarea id="reject-note" rows={3} {...form.register("note")} />
      {(form.formState.errors.note?.message || serverError) && (
        <span className="text-xs text-destructive">
          {form.formState.errors.note?.message ?? serverError}
        </span>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Rejecting…" : "Confirm rejection"}
        </Button>
      </div>
    </form>
  );
}

function UploadPanel({
  title,
  description,
  path,
  token,
  onDone,
}: {
  title: string;
  description: string;
  path: string;
  token: string | null;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function start(selected: File) {
    setFile(selected);
    setError(null);
    setProgress(0);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await uploadWithProgress({
        path,
        file: selected,
        token,
        onProgress: setProgress,
        signal: controller.signal,
      });
      toast.success(`${title} uploaded.`);
      setProgress(null);
      setFile(null);
      onDone();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setProgress(null);
        return;
      }
      setError(messageForError(err, "The upload failed."));
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div
      className={`grid gap-2 border border-dashed p-3 ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) void start(dropped);
      }}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void start(chosen);
          event.target.value = "";
        }}
      />

      {!uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={15} /> Choose or drop a file
        </Button>
      )}

      {uploading && (
        <div className="grid gap-1">
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">
              {file?.name} · {progress}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label="Cancel upload"
              onClick={() => controllerRef.current?.abort()}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="grid gap-1">
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
          {file && (
            <Button type="button" size="sm" variant="outline" onClick={() => void start(file)}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
