"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { useListQuery } from "@/lib/use-list-query";
import type {
  AccountStatus,
  AdminCustomer,
  AdminCustomerList,
  ManagerCustomerDetail,
  ManagerSummary,
} from "@/lib/types";

const TABS: { status: AccountStatus; label: string }[] = [
  { status: "pending_approval", label: "Pending approval" },
  { status: "approved", label: "Approved" },
  { status: "suspended", label: "Suspended" },
];

/** A count badge per tab, asked with pageSize=1 so only the total matters. */
function useStatusCount(status: AccountStatus) {
  return useQuery({
    queryKey: ["admin-customers", "count", status],
    queryFn: () =>
      apiRequest<AdminCustomerList>(`/admin/customers?status=${status}&page=1&pageSize=1`),
    select: (data) => data.total,
  });
}

export default function AdminCustomersPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<AccountStatus>("pending_approval");
  const [search, setSearch] = useState("");

  const counts: Record<AccountStatus, ReturnType<typeof useStatusCount>> = {
    pending_approval: useStatusCount("pending_approval"),
    approved: useStatusCount("approved"),
    suspended: useStatusCount("suspended"),
  };

  const list = useListQuery<AdminCustomer>({
    key: "admin-customers",
    path: "/admin/customers",
    pageSize: 20,
    filters: { status: tab, search: search.trim() || undefined },
  });

  const managers = useQuery({
    queryKey: ["admin-managers"],
    queryFn: () => apiRequest<ManagerSummary[]>("/admin/managers"),
  });
  const managerById = useMemo(
    () => new Map((managers.data ?? []).map((m) => [m.id, m])),
    [managers.data],
  );

  const [approving, setApproving] = useState<AdminCustomer | null>(null);
  const [suspending, setSuspending] = useState<AdminCustomer | null>(null);
  const [reactivating, setReactivating] = useState<AdminCustomer | null>(null);
  const [reassigning, setReassigning] = useState<AdminCustomer | null>(null);

  function refresh() {
    void client.invalidateQueries({ queryKey: ["admin-customers"] });
  }

  const suspend = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/customers/${id}/suspend`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Customer suspended.");
      setSuspending(null);
      refresh();
    },
  });
  const reactivate = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/customers/${id}/reactivate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Customer reactivated.");
      setReactivating(null);
      refresh();
    },
  });

  const managerName = (id: string | null) => {
    if (!id) return "—";
    const m = managerById.get(id);
    return m ? (m.name ?? m.email) : "Assigned";
  };

  const columns: Column<AdminCustomer>[] = [
    {
      id: "account",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name ?? "Unnamed"}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      id: "persona",
      header: "Persona",
      hideBelow: "md",
      cell: (row) => (row.persona ? <StatusBadge status={row.persona} /> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "city",
      header: "City",
      hideBelow: "lg",
      cell: (row) => row.city ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "manager",
      header: "Manager",
      hideBelow: "md",
      cell: (row) => <span className="text-sm">{managerName(row.managerId)}</span>,
    },
    {
      id: "registered",
      header: "Registered",
      hideBelow: "sm",
      cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Account lifecycle"
        title="Customers"
        description="Approve new registrations, assign managers, and manage account access."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((item) => {
          const count = counts[item.status].data;
          const active = tab === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => setTab(item.status)}
              className={
                active
                  ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  : "rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {item.label}
              {count !== undefined && (
                <span className={active ? "ml-2 opacity-80" : "ml-2 text-muted-foreground"}>({count})</span>
              )}
            </button>
          );
        })}
        <Input
          aria-label="Search customers"
          placeholder="Search name or email"
          className="ml-auto w-full sm:w-64"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun="customer"
        emptyMessage={`No ${TABS.find((t) => t.status === tab)?.label.toLowerCase()} customers.`}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            {row.accountStatus === "pending_approval" && (
              <Button size="sm" onClick={() => setApproving(row)}>
                Approve
              </Button>
            )}
            {row.accountStatus === "approved" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setReassigning(row)}>
                  Reassign
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setSuspending(row)}>
                  Suspend
                </Button>
              </>
            )}
            {row.accountStatus === "suspended" && (
              <Button size="sm" onClick={() => setReactivating(row)}>
                Reactivate
              </Button>
            )}
          </div>
        )}
      />

      {approving && (
        <ApproveDialog
          customer={approving}
          managers={managers.data ?? []}
          onOpenChange={(open) => !open && setApproving(null)}
          onApproved={() => {
            setApproving(null);
            refresh();
            void client.invalidateQueries({ queryKey: ["admin-managers"] });
          }}
        />
      )}

      {reassigning && (
        <ReassignDialog
          customer={reassigning}
          managers={managers.data ?? []}
          onOpenChange={(open) => !open && setReassigning(null)}
          onDone={() => {
            setReassigning(null);
            refresh();
            void client.invalidateQueries({ queryKey: ["admin-managers"] });
          }}
        />
      )}

      <ConfirmDialog
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title="Suspend customer"
        description={`Suspend ${suspending?.name ?? suspending?.email ?? "this customer"}? They lose portal access and any active session ends immediately.`}
        confirmLabel="Suspend"
        variant="destructive"
        isPending={suspend.isPending}
        error={suspend.error}
        onConfirm={() => suspending && suspend.mutate(suspending.id)}
      />

      <ConfirmDialog
        open={reactivating !== null}
        onOpenChange={(open) => !open && setReactivating(null)}
        title="Reactivate customer"
        description={`Restore portal access for ${reactivating?.name ?? reactivating?.email ?? "this customer"}?`}
        confirmLabel="Reactivate"
        isPending={reactivate.isPending}
        error={reactivate.error}
        onConfirm={() => reactivating && reactivate.mutate(reactivating.id)}
      />
    </div>
  );
}

/** Approve dialog: shows the customer's onboarding + persona and requires a manager. */
function ApproveDialog({
  customer,
  managers,
  onOpenChange,
  onApproved,
}: {
  customer: AdminCustomer;
  managers: ManagerSummary[];
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}) {
  const [managerId, setManagerId] = useState(customer.managerId ?? "");

  // The admin may read any customer's onboarding via the manager detail endpoint.
  const detail = useQuery({
    queryKey: ["manager-customer", customer.id],
    queryFn: () => apiRequest<ManagerCustomerDetail>(`/manager/customers/${customer.id}`),
  });

  const approve = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/customers/${customer.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ managerId }),
      }),
    onSuccess: () => {
      toast.success("Customer approved and manager assigned.");
      onApproved();
    },
  });

  const onboarding = detail.data?.onboarding;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {customer.name ?? customer.email}</DialogTitle>
          <DialogDescription>Review onboarding and assign a manager to approve this account.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
          {detail.isLoading && <p className="text-muted-foreground">Loading onboarding…</p>}
          {detail.isError && (
            <p className="text-muted-foreground">Onboarding details could not be loaded.</p>
          )}
          {onboarding && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Persona">
                {onboarding.persona ? <StatusBadge status={onboarding.persona} /> : "—"}
              </Field>
              <Field label="Completed">{onboarding.completed ? "Yes" : "Not yet"}</Field>
              <Field label="Legal name">{onboarding.legalName ?? "—"}</Field>
              <Field label="Contact">{onboarding.contactName ?? "—"}</Field>
              <Field label="Phone">{onboarding.phone ?? "—"}</Field>
              <Field label="Location">
                {[onboarding.city, onboarding.state].filter(Boolean).join(", ") || "—"}
              </Field>
              <Field label="Notification emails" full>
                {onboarding.notificationEmails.length ? onboarding.notificationEmails.join(", ") : "—"}
              </Field>
            </dl>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="manager">Manager</Label>
          <select
            id="manager"
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
          >
            <option value="">Select a manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.name ?? m.email)} — {m.customerCount} customer{m.customerCount === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          {managers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No managers exist yet. Create one on the Users page first.
            </p>
          )}
        </div>

        {approve.error !== undefined && approve.error !== null && (
          <p role="alert" className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {messageForError(approve.error, "The customer could not be approved.")}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button onClick={() => approve.mutate()} disabled={approve.isPending || !managerId}>
            {approve.isPending ? "Approving…" : "Approve & assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reassign a customer's manager, recording a reason (logged server-side). */
function ReassignDialog({
  customer,
  managers,
  onOpenChange,
  onDone,
}: {
  customer: AdminCustomer;
  managers: ManagerSummary[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [managerId, setManagerId] = useState(customer.managerId ?? "");
  const [reason, setReason] = useState("");

  const reassign = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/customers/${customer.id}/manager`, {
        method: "POST",
        body: JSON.stringify({ managerId, reason }),
      }),
    onSuccess: () => {
      toast.success("Manager reassigned.");
      onDone();
    },
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign manager</DialogTitle>
          <DialogDescription>Move {customer.name ?? customer.email} to a different manager.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reassign-manager">Manager</Label>
          <select
            id="reassign-manager"
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
          >
            <option value="">Select a manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.name ?? m.email)} — {m.customerCount} customer{m.customerCount === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reassign-reason">Reason</Label>
          <Textarea
            id="reassign-reason"
            placeholder="Why is this customer being reassigned?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {reassign.error !== undefined && reassign.error !== null && (
          <p role="alert" className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {messageForError(reassign.error, "The manager could not be reassigned.")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reassign.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => reassign.mutate()}
            disabled={reassign.isPending || !managerId || reason.trim().length < 3}
          >
            {reassign.isPending ? "Saving…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
