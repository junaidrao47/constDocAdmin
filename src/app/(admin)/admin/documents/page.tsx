"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { DocumentDrawer } from "@/components/document-drawer";
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
import { apiRequest } from "@/lib/api";
import { useStatusContract } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import type {
  DocumentRecord,
  Requirement,
  Service,
  UserList,
} from "@/lib/types";
import { useListQuery } from "@/lib/use-list-query";

export default function AdminDocumentsPage() {
  const { session } = useAuth();
  const role = session?.user.role ?? "admin";
  const token = session?.accessToken ?? null;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [selected, setSelected] = useState<DocumentRecord | null>(null);

  const contract = useStatusContract();

  const list = useListQuery<DocumentRecord>({
    key: "admin-documents",
    path: "/admin/documents",
    mode: "server",
    filters: {
      status: statusFilter === "all" ? undefined : statusFilter,
      customerId: customerFilter === "all" ? undefined : customerFilter,
    },
  });

  // Customers resolve UUIDs to names/emails and populate the customer filter.
  const customers = useQuery({
    queryKey: ["admin-users", "customer"],
    queryFn: () => apiRequest<UserList>("/admin/users?role=customer&pageSize=100"),
  });
  const customerMap = new Map(
    (customers.data?.items ?? []).map((u) => [u.id, { name: u.name ?? u.email, email: u.email }]),
  );

  const services = useQuery({
    queryKey: ["admin-services", "all"],
    queryFn: () => apiRequest<Service[]>("/admin/services"),
  });
  const serviceMap = new Map((services.data ?? []).map((s) => [s.id, s.nameEn ?? s.name]));

  // Requirement names come from each service's requirement list (there is no global
  // requirements endpoint), fetched once per distinct service on screen.
  const serviceIds = [...new Set(list.rows.map((r) => r.serviceId).filter(Boolean))] as string[];
  const requirementQueries = useQueries({
    queries: serviceIds.map((sid) => ({
      queryKey: ["service-requirements", sid],
      queryFn: () => apiRequest<Requirement[]>(`/admin/services/${sid}/requirements`),
    })),
  });
  const requirementMap = new Map<string, string>();
  for (const q of requirementQueries) {
    for (const req of q.data ?? []) requirementMap.set(req.id, req.nameEn);
  }

  const columns: Column<DocumentRecord>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (row) => {
        const customer = customerMap.get(row.customerId);
        return customer ? (
          <>
            <p className="font-medium">{customer.name}</p>
            <p className="text-xs text-muted-foreground">{customer.email}</p>
          </>
        ) : (
          <span className="text-muted-foreground">
            {customers.isLoading ? "Loading…" : "Unknown customer"}
          </span>
        );
      },
    },
    {
      id: "service",
      header: "Service",
      cell: (row) => (row.serviceId ? (serviceMap.get(row.serviceId) ?? "—") : "—"),
      hideBelow: "md",
    },
    {
      id: "requirement",
      header: "Requirement",
      cell: (row) =>
        row.requirementId ? (requirementMap.get(row.requirementId) ?? row.fileName) : row.fileName,
      hideBelow: "lg",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (row) => formatDate(row.updatedAt),
      hideBelow: "md",
    },
  ];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Review queue"
        title="Documents"
        description="Review customer submissions, record decisions, and upload the approved official file."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(contract.data?.statuses ?? []).map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.value.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Customer</span>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-56" aria-label="Filter by customer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {(customers.data?.items ?? []).map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name ?? customer.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun="document"
        emptyMessage="No documents match these filters."
        actions={(row) => (
          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
            Review
          </Button>
        )}
      />

      {selected && (
        <DocumentDrawer
          // Re-read from the (refetched) list so the drawer reflects a status change
          // without being reopened; fall back to the captured row if it paged out.
          document={list.rows.find((row) => row.id === selected.id) ?? selected}
          customerLabel={customerMap.get(selected.customerId)?.name ?? "Unknown customer"}
          serviceLabel={selected.serviceId ? (serviceMap.get(selected.serviceId) ?? "—") : "—"}
          role={role}
          token={token}
          open
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </div>
  );
}
