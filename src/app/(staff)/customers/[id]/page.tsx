"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/phase-progress";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ManagerCustomerDetail } from "@/lib/types";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useQuery({
    queryKey: ["manager-customer", id],
    queryFn: () => apiRequest<ManagerCustomerDetail>(`/manager/customers/${id}`),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4 p-5 sm:p-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-5 sm:p-8">
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href="/customers">← Back</Link>
        </Button>
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-semibold">{errorMessage(query.error, "This customer could not be loaded.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { customer, onboarding, subscriptions, documents, timeline } = query.data;

  return (
    <div className="p-5 sm:p-8">
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link href="/customers">← My Customers</Link>
      </Button>

      <PageHeader
        eyebrow="Customer"
        title={customer.name ?? customer.email}
        description={customer.email}
        actions={
          <div className="flex items-center gap-2">
            {onboarding.persona && <StatusBadge status={onboarding.persona} />}
            <StatusBadge status={customer.accountStatus} />
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Onboarding</h2>
              {!onboarding.completed && (
                <p className="mb-3 text-xs text-warning">Onboarding is not yet complete.</p>
              )}
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Persona">{onboarding.persona ?? "—"}</Field>
                <Field label="Legal name">{onboarding.legalName ?? "—"}</Field>
                <Field label="Contact">{onboarding.contactName ?? "—"}</Field>
                <Field label="Phone">{onboarding.phone ?? customer.phone ?? "—"}</Field>
                <Field label="Location">{[onboarding.city, onboarding.state].filter(Boolean).join(", ") || "—"}</Field>
                <Field label="Preferred language">{customer.preferredLocale}</Field>
                <Field label="Notification emails">
                  {onboarding.notificationEmails.length ? onboarding.notificationEmails.join(", ") : "—"}
                </Field>
                <Field label="Needs">{onboarding.needs.length ? onboarding.needs.join(", ") : "—"}</Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Subscriptions
              </h2>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {subscriptions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)}
                      </span>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          {documents.length === 0 ? (
            <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              This customer has no documents yet.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.fileName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Target: {formatDate(doc.targetDate)}
                      </p>
                    </div>
                    <div className="sm:w-56">
                      <ProgressBar progress={doc.progress} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.status} />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/documents/${doc.id}`}>Open</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-5">
          {timeline.length === 0 ? (
            <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <Card>
              <CardContent className="p-5">
                <ol className="space-y-4">
                  {timeline.map((entry, index) => (
                    <li key={`${entry.documentId}-${entry.at}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p>
                          <span className="font-medium">
                            {entry.type === "phase" ? "Phase" : "Document"}
                          </span>{" "}
                          {entry.fromStatus ? `${humanize(entry.fromStatus)} → ` : ""}
                          {humanize(entry.toStatus)}
                        </p>
                        {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                        <p className="text-xs text-muted-foreground">{formatDate(entry.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
