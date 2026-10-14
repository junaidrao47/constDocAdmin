"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  isDestructive,
  QUOTATION_STATUSES,
  QUOTATION_TRANSITIONS,
  statusLabel,
  transitionLabel,
} from "@/lib/quotation-status";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { useListQuery } from "@/lib/use-list-query";

interface PendingTransition {
  quotation: Quotation;
  to: QuotationStatus;
}

export default function AdminQuotationsPage() {
  const client = useQueryClient();
  const [status, setStatus] = useState<"" | QuotationStatus>("");
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [note, setNote] = useState("");

  const list = useListQuery<Quotation>({
    key: "admin-quotations",
    path: "/admin/quotations",
    // `sort` and the paginated response shape are both opt-in on this endpoint; asking
    // for a page is what turns them on.
    sort: "-createdAt",
    filters: { status: status || undefined },
  });

  const transition = useMutation({
    mutationFn: ({ quotation, to }: PendingTransition) =>
      apiRequest(`/admin/quotations/${quotation.id}/status`, {
        method: "PATCH",
        // The API has always accepted a note and recorded it in the status history;
        // the previous UI never sent one, so every override was unexplained.
        body: JSON.stringify({ status: to, note: note.trim() || undefined }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(`Quotation moved to ${statusLabel(variables.to).toLowerCase()}.`);
      closeDialog();
      void client.invalidateQueries({ queryKey: ["admin-quotations"] });
    },
    // No onError: the dialog stays open and renders `transition.error` in place, so the
    // 409 the state machine returns is readable where the action was taken.
  });

  function openDialog(quotation: Quotation, to: QuotationStatus) {
    transition.reset();
    setNote("");
    setPending({ quotation, to });
  }

  function closeDialog() {
    setPending(null);
    setNote("");
    transition.reset();
  }

  const columns: Column<Quotation>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <>
          <p className="font-medium">{row.customer?.name ?? row.customer?.email ?? "Unnamed"}</p>
          {row.customer?.name && row.customer.email && (
            <p className="text-xs text-muted-foreground">{row.customer.email}</p>
          )}
        </>
      ),
    },
    {
      id: "workers",
      header: "Workers",
      cell: (row) => row.workerCount,
      hideBelow: "lg",
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => formatDate(row.createdAt),
      sortKey: "createdAt",
      hideBelow: "md",
    },
    {
      id: "total",
      header: "Total",
      // Currency comes from the row, never a literal — the API sends it per quotation.
      cell: (row) => formatMoney(row.totalPrice, row.currency),
      sortKey: "totalPrice",
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
      sortKey: "status",
    },
  ];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Revenue operations"
        title="Quotation management"
        description="Monitor every customer estimate and override its lifecycle when required."
      />

      <div className="mb-5 grid gap-3 sm:max-w-xs">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
          <select
            aria-label="Filter by status"
            className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-normal normal-case tracking-normal text-foreground"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | QuotationStatus)}
          >
            <option value="">All statuses</option>
            {QUOTATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun="quotation"
        emptyMessage={
          status
            ? `No quotations are currently ${statusLabel(status).toLowerCase()}.`
            : "No quotations have been created yet."
        }
        actions={(row) => {
          const moves = QUOTATION_TRANSITIONS[row.status] ?? [];
          if (moves.length === 0) {
            // A terminal status. Saying so beats an empty cell that looks unfinished.
            return <span className="text-xs text-muted-foreground">No further action</span>;
          }

          return (
            <div className="flex flex-wrap justify-end gap-2">
              {moves.map((to) => (
                <Button
                  key={to}
                  size="sm"
                  variant={isDestructive(to) ? "destructive" : "default"}
                  onClick={() => openDialog(row, to)}
                >
                  {transitionLabel(to)}
                </Button>
              ))}
            </div>
          );
        }}
      />

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          title={`${transitionLabel(pending.to)} this quotation?`}
          description={`${
            pending.quotation.customer?.name ?? pending.quotation.customer?.email ?? "This customer"
          } · ${formatMoney(pending.quotation.totalPrice, pending.quotation.currency)} · moving from ${statusLabel(
            pending.quotation.status,
          ).toLowerCase()} to ${statusLabel(pending.to).toLowerCase()}.`}
          confirmLabel={transitionLabel(pending.to)}
          variant={isDestructive(pending.to) ? "destructive" : "default"}
          isPending={transition.isPending}
          error={transition.error ?? undefined}
          onConfirm={() => transition.mutate(pending)}
        >
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="transition-note">
              Note {isDestructive(pending.to) ? "(shown to the customer)" : "(optional)"}
            </label>
            <Textarea
              id="transition-note"
              rows={3}
              value={note}
              placeholder="Why this status is changing. Recorded in the quotation's history."
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
