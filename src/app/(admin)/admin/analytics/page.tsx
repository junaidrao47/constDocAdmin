"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { AnalyticsOverview } from "@/lib/types";

/** Categorical series colours, all from the shared tokens (never raw hex in JSX). */
const PALETTE = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

function humanizeDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.round((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.round(seconds / 60)}m`;
}

function humanizeStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function sum(rows: { count: number }[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Recharts' ResponsiveContainer needs a measured width; render it only after mount
  // so the server pass does not emit zero-size warnings or risk a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const queryString = params.toString();

  const query = useQuery({
    queryKey: ["admin-analytics", queryString],
    queryFn: () => apiRequest<AnalyticsOverview>(`/admin/analytics/overview${queryString ? `?${queryString}` : ""}`),
  });

  const data = query.data;

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Platform analytics"
        title="Analytics"
        description="Customers, documents, phase throughput, quotations and revenue (MXN)."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input id="from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input id="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
            </div>
            {(from || to) && (
              <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
                Reset
              </Button>
            )}
          </div>
        }
      />

      {query.isError && (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{errorMessage(query.error, "Unable to load analytics.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      )}

      {query.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={`c${i}`} className="h-72 w-full sm:col-span-2" />)}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Revenue (paid, in range)" value={formatMoney(data.revenue.total, data.revenue.currency)} />
            <Kpi label="New registrations (in range)" value={String(sum(data.registrationsOverTime))} />
            <Kpi label="Avg phase duration" value={humanizeDuration(data.averagePhaseDurationSeconds)} />
            <Kpi
              label="Pending approvals"
              value={String(data.customersByStatus.find((c) => c.status === "pending_approval")?.count ?? 0)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Registrations over time" empty={data.registrationsOverTime.length === 0}>
              {mounted && (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.registrationsOverTime.map((r) => ({ day: new Date(r.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), count: r.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="count" name="Registrations" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Documents by status" empty={data.documentsByStatus.length === 0}>
              {mounted && (
                <CategoryBars rows={data.documentsByStatus.map((r) => ({ label: humanizeStatus(r.status), count: r.count }))} />
              )}
            </ChartCard>

            <ChartCard title="Customers by status" empty={data.customersByStatus.length === 0}>
              {mounted && (
                <CategoryBars rows={data.customersByStatus.map((r) => ({ label: humanizeStatus(r.status), count: r.count }))} />
              )}
            </ChartCard>

            <ChartCard title="Quotation funnel" empty={data.quotationsFunnel.length === 0}>
              {mounted && (
                <CategoryBars rows={data.quotationsFunnel.map((r) => ({ label: humanizeStatus(r.status), count: r.count }))} />
              )}
            </ChartCard>

            <ChartCard title="Documents waiting per manager" empty={data.documentsWaitingPerManager.length === 0}>
              {mounted && (
                <CategoryBars rows={data.documentsWaitingPerManager.map((r) => ({ label: r.managerEmail, count: r.waiting }))} />
              )}
            </ChartCard>

            <ChartCard title="Emails sent vs failed" empty={data.emails.length === 0}>
              {mounted && (
                <CategoryBars rows={data.emails.map((r) => ({ label: humanizeStatus(r.status), count: r.count }))} />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** A categorical bar chart that colours each bar from the shared token palette. */
function CategoryBars({ rows }: { rows: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" interval={0} angle={rows.length > 4 ? -20 : 0} textAnchor={rows.length > 4 ? "end" : "middle"} height={rows.length > 4 ? 60 : 30} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
        <Tooltip contentStyle={{ fontSize: 12 }} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
          {rows.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
