"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "submitted_to_government", label: "Submitted to government" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
];

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const documents = useQuery({
    queryKey: ["documents", statusFilter],
    queryFn: () =>
      apiRequest<DocumentRecord[]>(
        `/agent/documents${statusFilter === "all" ? "" : `?status=${statusFilter}`}`,
      ),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, toStatus, fromStatus }: { id: string; toStatus: DocumentStatus; fromStatus: DocumentStatus }) =>
      apiRequest(`/documents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ fromStatus, toStatus }),
      }),
    onSuccess: () => {
      setFeedback("Document status updated.");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const rows = documents.data ?? [];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Review queue"
        title="My documents queue"
        description="Documents from your assigned customers. Open one to manage its phases, preview files and record decisions."
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void documents.refetch()}
            disabled={documents.isFetching}
          >
            <RefreshCw size={15} className={documents.isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      {feedback && (
        <p role="status" className="mb-4 rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
          {feedback}
        </p>
      )}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {documents.isError && (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{errorMessage(documents.error, "The review queue is unavailable.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void documents.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {documents.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {documents.isSuccess && rows.length === 0 && (
        <div className="border border-border bg-card p-12 text-center">
          <FileCheck2 className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nothing in the queue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "No documents from your assigned customers yet."
              : "No documents match this status."}
          </p>
        </div>
      )}

      {documents.isSuccess && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">File</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((document) => (
                <tr key={document.id} className="transition hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <Link href={`/documents/${document.id}`} className="flex items-center gap-3 group">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileCheck2 size={16} />
                      </span>
                      <span className="font-medium group-hover:text-primary group-hover:underline">
                        {document.fileName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">{document.customerName ?? "—"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{formatDate(document.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      {document.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ id: document.id, fromStatus: document.status, toStatus: "under_review" })
                          }
                        >
                          Start review
                        </Button>
                      )}
                      {document.status === "under_review" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ id: document.id, fromStatus: document.status, toStatus: "approved" })
                          }
                        >
                          Approve
                        </Button>
                      )}
                      <Button asChild size="sm">
                        <Link href={`/documents/${document.id}`}>Open</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
