"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calculator,
  FileText,
  Receipt,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format";
import type { AnalyticsOverview } from "@/lib/types";

function count(rows: { status?: string; count: number }[], status?: string): number {
  if (!status) return rows.reduce((total, row) => total + row.count, 0);
  return rows.find((row) => row.status === status)?.count ?? 0;
}

const QUICK_LINKS = [
  { href: "/admin/customers", label: "Customers", icon: Users, hint: "Approvals, personas, manager assignment" },
  { href: "/admin/documents", label: "Documents", icon: FileText, hint: "Oversight across every phase" },
  { href: "/admin/quotations", label: "Quotations", icon: Receipt, hint: "Funnel from draft to converted" },
  { href: "/admin/calculator", label: "Calculator & pricing", icon: Calculator, hint: "Rules behind the public quote" },
];

export default function AdminDashboardPage() {
  const { session } = useAuth();

  // Reuses the real overview endpoint (last 30 days by default). The bare /admin/analytics
  // is a stub — never read it. Subscriptions are intentionally absent (that endpoint is a stub too).
  const query = useQuery({
    queryKey: ["admin-analytics", ""],
    queryFn: () => apiRequest<AnalyticsOverview>("/admin/analytics/overview"),
  });
  const data = query.data;

  return (
    <div className="p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Administrator workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Platform control center</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Welcome, {session?.user.name ?? session?.user.email}. A snapshot of the last 30 days —
        open{" "}
        <Link href="/admin/analytics" className="font-medium text-primary underline">
          Analytics
        </Link>{" "}
        for charts and a custom date range.
      </p>

      {query.isError && (
        <div role="alert" className="mt-8 border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{errorMessage(query.error, "Unable to load the dashboard.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* KPI tiles */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {query.isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : (
          <>
            <Kpi label="Revenue (paid, 30 days)" value={formatMoney(data.revenue.total, data.revenue.currency)} />
            <Kpi
              label="Customers"
              value={String(count(data.customersByStatus))}
              sub={`${count(data.customersByStatus, "approved")} approved`}
            />
            <Kpi
              label="Pending approvals"
              value={String(count(data.customersByStatus, "pending_approval"))}
              sub="Awaiting admin review"
              emphasize={count(data.customersByStatus, "pending_approval") > 0}
            />
            <Kpi
              label="Documents in review"
              value={String(count(data.documentsByStatus, "under_review") + count(data.documentsByStatus, "pending"))}
              sub={`${count(data.documentsByStatus)} total tracked`}
            />
          </>
        )}
      </div>

      {/* Managers' workload + new customers */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Managers — documents waiting</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.documentsWaitingPerManager.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents are waiting on a manager right now.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.documentsWaitingPerManager.map((row) => (
                  <li key={row.managerId} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{row.managerEmail}</span>
                    <span className="ml-3 shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
                      {row.waiting} waiting
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New customers (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <p className="text-3xl font-semibold tabular-nums">{count(data.registrationsOverTime)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registrations in range. Suspended: {count(data.customersByStatus, "suspended")}.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map(({ href, label, icon: Icon, hint }) => (
          <Link
            key={href}
            href={href}
            className="group border border-border bg-card p-5 shadow-sm transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <Icon className="text-primary" />
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <h2 className="mt-4 font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, emphasize }: { label: string; value: string; sub?: string; emphasize?: boolean }) {
  return (
    <div className="border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${emphasize ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
