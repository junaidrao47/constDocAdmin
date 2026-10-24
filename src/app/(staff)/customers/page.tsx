"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/phase-progress";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, errorMessage } from "@/lib/api";
import type { ManagerCustomerListItem } from "@/lib/types";

export default function MyCustomersPage() {
  const query = useQuery({
    queryKey: ["manager-customers"],
    queryFn: () => apiRequest<ManagerCustomerListItem[]>("/manager/customers"),
  });

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Staff workspace"
        title="My Customers"
        description="Customers assigned to you, with pending documents and overall phase progress."
      />

      {query.isError && (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{errorMessage(query.error, "Unable to load your customers.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      )}

      {query.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      )}

      {query.data && query.data.length === 0 && (
        <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No customers are assigned to you yet.
        </p>
      )}

      {query.data && query.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{customer.name ?? "Unnamed"}</p>
                    <p className="break-all text-xs text-muted-foreground">{customer.email}</p>
                  </div>
                  <StatusBadge status={customer.accountStatus} />
                </div>
                <div className="mt-4">
                  <ProgressBar progress={customer.progress} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {customer.pendingDocuments} pending · {customer.documentsCount} document
                    {customer.documentsCount === 1 ? "" : "s"}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/customers/${customer.id}`}>Open</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
