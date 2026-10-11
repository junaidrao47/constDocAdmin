"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";

const statusLabels: Record<DocumentStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

function statusClass(status: DocumentStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  if (status === "under_review") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

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
      <header className="mb-8 flex items-end justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
            Review queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Documents pending review</h1>
          <p className="mt-2 text-sm text-slate-500">
            Inspect customer compliance files and record the next decision.
          </p>
        </div>
        <Button
          className="gap-2 border border-slate-300 bg-white text-slate-700"
          onClick={() => void documents.refetch()}
          disabled={documents.isFetching}
        >
          <RefreshCw size={15} className={documents.isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </header>
      {feedback && (
        <div className="mb-5 border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          {feedback}
        </div>
      )}
      {documents.isError && (
        <div className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">The review queue is unavailable.</p>
          <p className="mt-1">
            Refresh the page or contact an administrator if the staff document queue remains
            unavailable.
          </p>
        </div>
      )}
      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">File</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((document) => (
              <tr key={document.id}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-cyan-50 text-cyan-700">
                      <FileCheck2 size={16} />
                    </span>
                    <span className="font-medium">{document.fileName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">
                  {document.customerId}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold ${statusClass(document.status)}`}
                  >
                    {statusLabels[document.status]}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-500">{formatDate(document.updatedAt)}</td>
                <td className="px-5 py-4 text-right">
                  {document.status === "under_review" && (
                    <div className="flex justify-end gap-2">
                      <Button
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
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
                        className="bg-red-700 text-white hover:bg-red-800"
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
                      className="bg-slate-800 text-white hover:bg-slate-700"
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
          <div className="p-10 text-center text-sm text-slate-500">
            No documents returned by the API.
          </div>
        )}
      </div>
    </div>
  );
}
