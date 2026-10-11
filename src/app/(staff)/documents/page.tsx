"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { apiRequest, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiRequest<DocumentRecord[]>("/agent/documents"),
  });
  const updateStatus = useMutation({
    mutationFn: ({
      id,
      toStatus,
      fromStatus,
    }: {
      id: string;
      toStatus: DocumentStatus;
      fromStatus: DocumentStatus;
    }) =>
      apiRequest(`/documents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ fromStatus, toStatus }),
      }),
    onSuccess: () => {
      setFeedback("Document status updated.");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: unknown) =>
      setFeedback(error instanceof ApiError ? error.message : "Could not update document status."),
  });

  const rows = documents.data ?? [];
  return (
    <div className="p-5 sm:p-8">
      <header className="mb-8 flex items-end justify-between border-b border-border pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Review queue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Documents pending review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect customer compliance files and record the next decision.
          </p>
        </div>
        <Button
          className="gap-2 border border-border bg-card text-muted-foreground"
          onClick={() => void documents.refetch()}
          disabled={documents.isFetching}
        >
          <RefreshCw size={15} className={documents.isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </header>
      {feedback && (
        <div className="mb-5 border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      )}
      {documents.isError && (
        <div className="border border-warning/30 bg-warning/10 p-5 text-sm text-warning">
          <p className="font-semibold">The review queue is unavailable.</p>
          <p className="mt-1">
            Refresh the page or contact an administrator if the staff document queue remains
            unavailable.
          </p>
        </div>
      )}
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">File</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((document) => (
              <tr key={document.id}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
                      <FileCheck2 size={16} />
                    </span>
                    <span className="font-medium">{document.fileName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                  {document.customerId}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={document.status} />
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {formatDate(document.updatedAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  {document.status === "under_review" && (
                    <div className="flex justify-end gap-2">
                      <Button
                        className="bg-success text-primary-foreground hover:bg-success/90"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: document.id,
                            fromStatus: document.status,
                            toStatus: "approved",
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        className="bg-destructive text-primary-foreground hover:bg-destructive/90"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: document.id,
                            fromStatus: document.status,
                            toStatus: "rejected",
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {document.status === "pending" && (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          id: document.id,
                          fromStatus: document.status,
                          toStatus: "under_review",
                        })
                      }
                    >
                      Start review
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {documents.isSuccess && rows.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No documents returned by the API.
          </div>
        )}
      </div>
    </div>
  );
}
