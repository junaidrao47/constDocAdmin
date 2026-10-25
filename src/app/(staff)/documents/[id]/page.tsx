"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/phase-progress";
import { StatusBadge } from "@/components/status-badge";
import { UploadPanel } from "@/components/upload-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  allowedPhaseTransitions,
  allowedTransitions,
  usePhaseStatusContract,
  useStatusContract,
} from "@/lib/documents";
import { messageForError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type { DocumentDetail, DocumentPhase, DocumentVersion, PhaseStatus, UploadTarget, UserRole } from "@/lib/types";
import { uploadWithProgress } from "@/lib/upload";

const PHASE_ACTION_LABEL: Record<PhaseStatus, string> = {
  not_started: "Reset to not started",
  in_progress: "Mark in progress",
  completed: "Mark complete",
  rejected: "Reject",
};

const KIND_LABEL: Record<string, string> = {
  customer: "Customer",
  staff_on_behalf: "Staff (on behalf)",
  official: "Official",
  phase_result: "Phase result",
};

export default function StaffDocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { session } = useAuth();
  const role = session?.user.role;
  const token = session?.accessToken ?? null;
  const client = useQueryClient();

  const doc = useQuery({
    queryKey: ["staff-document", id],
    queryFn: () => apiRequest<DocumentDetail>(`/documents/${id}`),
    enabled: Boolean(id),
  });
  const versions = useQuery({
    queryKey: ["staff-document-versions", id],
    queryFn: () => apiRequest<DocumentVersion[]>(`/documents/${id}/versions`),
    enabled: Boolean(id),
  });
  const phaseContract = usePhaseStatusContract();

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["staff-document", id] });
    void client.invalidateQueries({ queryKey: ["staff-document-versions", id] });
  };

  if (doc.isLoading) {
    return (
      <div className="space-y-4 p-5 sm:p-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (doc.isError || !doc.data) {
    return (
      <div className="p-5 sm:p-8">
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{messageForError(doc.error, "This document could not be loaded.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void doc.refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const document = doc.data;
  const phases = [...document.phases].sort((a, b) => a.position - b.position);

  return (
    <div className="p-5 sm:p-8">
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link href="/documents">← Documents</Link>
      </Button>

      <PageHeader
        eyebrow="Document"
        title={document.fileName}
        description={`Overall target date: ${formatDate(document.targetDate)}`}
        actions={<StatusBadge status={document.status} />}
      />

      <div className="mb-6 max-w-md">
        <ProgressBar progress={document.progress} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
        {/* Left: decision + viewer + versions + staff uploads */}
        <div className="space-y-6">
          <DocumentDecision documentId={id} document={document} role={role} onDone={refresh} />

          <DocumentViewer documentId={id} versions={versions.data ?? []} />

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Versions ({versions.data?.length ?? 0})</h2>
            {versions.isLoading && <Skeleton className="h-16 w-full" />}
            {versions.data && versions.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
            )}
            <ul className="grid gap-2">
              {[...(versions.data ?? [])].sort((a, b) => a.versionNo - b.versionNo).map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-3 border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">v{version.versionNo} · {version.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[version.kind] ?? version.kind} · {formatDate(version.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Preview"
                      onClick={() => void openSignedUrl(id, version.id, "preview-url")}>
                      <Eye size={15} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Download"
                      onClick={() => void openSignedUrl(id, version.id, "download-url")}>
                      <Download size={15} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Staff upload</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadPanel
                title="On behalf of customer"
                description="Adds a customer version (document must be pending or rejected)."
                path={`/documents/${id}/upload`}
                token={token}
                onDone={refresh}
              />
              <UploadPanel
                title="Official file"
                description="The approved government file (document must be submitted to government)."
                path={`/documents/${id}/approved-upload`}
                token={token}
                onDone={refresh}
              />
            </div>
          </section>
        </div>

        {/* Right: phases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Phases</h2>
            <AddPhase documentId={id} onDone={refresh} />
          </div>

          {phaseContract.isError && (
            <p className="text-sm text-muted-foreground">Phase actions are unavailable right now.</p>
          )}

          {phases.length === 0 ? (
            <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No phases yet. Add the first approval phase to start tracking progress.
            </p>
          ) : (
            <ol className="space-y-3">
              {phases.map((phase, index) => (
                <PhaseCard
                  key={phase.id}
                  documentId={id}
                  phase={phase}
                  index={index}
                  total={phases.length}
                  allPhaseIds={phases.map((p) => p.id)}
                  allowed={allowedPhaseTransitions(phaseContract.data, phase.status)}
                  token={token}
                  onDone={refresh}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const DOC_STATUS_ACTION: Record<string, string> = {
  pending: "Reset to pending",
  under_review: "Start review",
  approved: "Approve",
  rejected: "Reject",
  submitted_to_government: "Submit to government",
  expiring_soon: "Mark expiring soon",
  expired: "Mark expired",
};

/** Document-level status decision, driven by the role's allowed transitions from the contract. */
function DocumentDecision({
  documentId,
  document,
  role,
  onDone,
}: {
  documentId: string;
  document: DocumentDetail;
  role: UserRole | undefined;
  onDone: () => void;
}) {
  const contract = useStatusContract();
  const allowed = allowedTransitions(contract.data, role, document.status);
  const [rejectNote, setRejectNote] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/documents/${documentId}/status`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Document updated.");
      setRejectNote(null);
      onDone();
    },
    onError: (error) => toast.error(messageForError(error, "Could not update the document.")),
  });

  if (allowed.length === 0) return null;

  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Decision</h2>
          <StatusBadge status={document.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {allowed.map((status) =>
            status === "rejected" ? (
              <Button
                key={status}
                size="sm"
                variant="destructive"
                disabled={change.isPending}
                onClick={() => setRejectNote(rejectNote === null ? "" : null)}
              >
                {DOC_STATUS_ACTION[status] ?? status}
              </Button>
            ) : (
              <Button
                key={status}
                size="sm"
                variant={status === "approved" ? "default" : "outline"}
                disabled={change.isPending}
                onClick={() => change.mutate({ fromStatus: document.status, toStatus: status })}
              >
                {DOC_STATUS_ACTION[status] ?? status}
              </Button>
            ),
          )}
        </div>
        {rejectNote !== null && (
          <div className="grid gap-2">
            <Textarea
              rows={2}
              placeholder="Reason for rejection (min 5 characters)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setRejectNote(null)} disabled={change.isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={change.isPending || rejectNote.trim().length < 5}
                onClick={() => change.mutate({ fromStatus: document.status, toStatus: "rejected", note: rejectNote })}
              >
                Confirm rejection
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function openSignedUrl(documentId: string, versionId: string, mode: "download-url" | "preview-url") {
  try {
    const result = await apiRequest<{ downloadUrl: string }>(`/documents/${documentId}/versions/${versionId}/${mode}`);
    window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    toast.error(messageForError(error, "Could not open the file."));
  }
}

/** Inline file viewer: loads the chosen version's preview URL into an iframe. */
function DocumentViewer({ documentId, versions }: { documentId: string; versions: DocumentVersion[] }) {
  const sorted = useMemo(() => [...versions].sort((a, b) => b.versionNo - a.versionNo), [versions]);
  const latest = sorted[0];

  const preview = useQuery({
    queryKey: ["staff-document-preview", documentId, latest?.id],
    queryFn: () => apiRequest<{ downloadUrl: string }>(`/documents/${documentId}/versions/${latest!.id}/preview-url`),
    enabled: Boolean(latest),
  });

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Preview {latest ? `· v${latest.versionNo}` : ""}</h2>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted">
        {!latest && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No file to preview.</div>
        )}
        {latest && preview.isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading preview…</div>
        )}
        {latest && preview.data && (
          <iframe title="Document preview" src={preview.data.downloadUrl} className="h-full w-full" />
        )}
        {latest && preview.isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Preview unavailable — use download instead.
          </div>
        )}
      </div>
    </section>
  );
}

function AddPhase({ documentId, onDone }: { documentId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nameEn: "", nameEs: "", department: "", targetDate: "" });

  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/documents/${documentId}/phases`, {
        method: "POST",
        body: JSON.stringify({
          phases: [
            {
              nameEn: form.nameEn.trim(),
              nameEs: form.nameEs.trim(),
              department: form.department.trim() || null,
              targetDate: form.targetDate || null,
            },
          ],
        }),
      }),
    onSuccess: () => {
      toast.success("Phase added.");
      setForm({ nameEn: "", nameEs: "", department: "", targetDate: "" });
      setOpen(false);
      onDone();
    },
    onError: (error) => toast.error(messageForError(error, "Could not add the phase.")),
  });

  if (!open) {
    return <Button size="sm" onClick={() => setOpen(true)}>Add phase</Button>;
  }

  return (
    <Card className="w-full">
      <CardContent className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="nameEn" className="text-xs">Name (EN)</Label>
            <Input id="nameEn" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="nameEs" className="text-xs">Name (ES)</Label>
            <Input id="nameEs" value={form.nameEs} onChange={(e) => setForm({ ...form, nameEs: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="department" className="text-xs">Department / authority</Label>
            <Input id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="targetDate" className="text-xs">Target date</Label>
            <Input id="targetDate" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
          <Button size="sm" disabled={create.isPending || !form.nameEn.trim() || !form.nameEs.trim()} onClick={() => create.mutate()}>
            {create.isPending ? "Adding…" : "Add phase"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseCard({
  documentId,
  phase,
  index,
  total,
  allPhaseIds,
  allowed,
  token,
  onDone,
}: {
  documentId: string;
  phase: DocumentPhase;
  index: number;
  total: number;
  allPhaseIds: string[];
  allowed: PhaseStatus[];
  token: string | null;
  onDone: () => void;
}) {
  const [rejectingNote, setRejectingNote] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/documents/${documentId}/phases/${phase.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Phase updated.");
      setRejectingNote(null);
      onDone();
    },
    onError: (error) => toast.error(messageForError(error, "Could not update the phase.")),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) =>
      apiRequest(`/documents/${documentId}/phases`, { method: "POST", body: JSON.stringify({ order }) }),
    onSuccess: onDone,
    onError: (error) => toast.error(messageForError(error, "Could not reorder phases.")),
  });

  function move(direction: -1 | 1) {
    const order = [...allPhaseIds];
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    reorder.mutate(order);
  }

  async function uploadResult(file: File, opts: { onProgress: (n: number) => void; signal: AbortSignal }) {
    const intent = await apiRequest<UploadTarget>(`/documents/${documentId}/phases/${phase.id}/result-upload-intent`, {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }),
    });
    await uploadWithProgress({
      path: `/documents/${documentId}/versions/${intent.versionId}/upload`,
      file,
      token,
      onProgress: opts.onProgress,
      signal: opts.signal,
    });
    await apiRequest(`/documents/${documentId}/phases/${phase.id}/result/${intent.versionId}/confirm`, { method: "POST" });
  }

  return (
    <li className="border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="text-muted-foreground">{index + 1}.</span> {phase.nameEn}
          </p>
          <p className="text-xs text-muted-foreground">{phase.nameEs}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {phase.department ? `${phase.department} · ` : ""}Target: {formatDate(phase.targetDate)}
          </p>
          {phase.note && <p className="mt-2 text-sm">{phase.note}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={phase.status} />
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up"
              disabled={index === 0 || reorder.isPending} onClick={() => move(-1)}>
              <ArrowUp size={14} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down"
              disabled={index === total - 1 || reorder.isPending} onClick={() => move(1)}>
              <ArrowDown size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {allowed.map((status) =>
          status === "rejected" ? (
            <Button key={status} size="sm" variant="destructive" disabled={update.isPending}
              onClick={() => setRejectingNote(rejectingNote === null ? "" : null)}>
              {PHASE_ACTION_LABEL[status]}
            </Button>
          ) : status === "completed" ? (
            <div key={status} className="flex gap-2">
              <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ status })}>
                {PHASE_ACTION_LABEL[status]}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowUpload((v) => !v)}>
                Complete by upload
              </Button>
            </div>
          ) : (
            <Button key={status} size="sm" variant="outline" disabled={update.isPending}
              onClick={() => update.mutate({ status })}>
              {PHASE_ACTION_LABEL[status]}
            </Button>
          ),
        )}
      </div>

      {rejectingNote !== null && (
        <div className="mt-3 grid gap-2">
          <Textarea
            rows={2}
            placeholder="Reason for rejection (min 5 characters)"
            value={rejectingNote}
            onChange={(e) => setRejectingNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRejectingNote(null)} disabled={update.isPending}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={update.isPending || rejectingNote.trim().length < 5}
              onClick={() => update.mutate({ status: "rejected", note: rejectingNote })}>
              Confirm rejection
            </Button>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="mt-3">
          <UploadPanel
            title="Phase result"
            description="Uploading the resulting file completes this phase."
            token={token}
            upload={uploadResult}
            onDone={() => {
              setShowUpload(false);
              onDone();
            }}
          />
        </div>
      )}
    </li>
  );
}
