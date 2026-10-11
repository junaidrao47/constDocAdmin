"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Quotation, QuotationStatus } from "@/lib/types";

export default function AdminQuotationsPage() {
  const client = useQueryClient();
  const quotations = useQuery({
    queryKey: ["admin-quotations"],
    queryFn: () => apiRequest<Quotation[]>("/admin/quotations"),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
      apiRequest(`/admin/quotations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-quotations"] }),
  });
  return (
    <div className="p-5 sm:p-8">
      <header className="mb-8 border-b border-border pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Revenue operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Quotation management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Monitor every customer estimate and override its lifecycle when required.
        </p>
      </header>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(quotations.data ?? []).map((quotation) => (
              <tr key={quotation.id}>
                <td className="px-5 py-4">
                  {quotation.customer?.name ?? quotation.customer?.email ?? quotation.customerId}
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {new Date(quotation.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-4">
                  {formatMoney(quotation.totalPrice, quotation.currency)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={quotation.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  {quotation.status === "draft" && (
                    <button
                      className="bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                      onClick={() => update.mutate({ id: quotation.id, status: "sent" })}
                    >
                      Send
                    </button>
                  )}
                  {quotation.status === "under_review" && (
                    <button
                      className="bg-success px-3 py-2 text-xs font-semibold text-primary-foreground"
                      onClick={() => update.mutate({ id: quotation.id, status: "accepted" })}
                    >
                      Accept
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {quotations.isError && (
        <p className="mt-5 text-sm text-destructive">Unable to load quotations.</p>
      )}
    </div>
  );
}
