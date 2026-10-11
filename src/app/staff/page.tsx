"use client";

import Link from "next/link";
import { FileCheck2, Users } from "lucide-react";
import StaffLayout from "@/app/(staff)/layout";
import { useAuth } from "@/lib/auth-context";

function StaffDashboardContent() {
  const { session } = useAuth();

  return (
    <div className="p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Staff workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Good to see you, {session?.user.name ?? session?.user.email}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Keep customer compliance work moving from one focused queue.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          className="border border-border bg-card p-6 shadow-sm transition hover:border-primary"
          href="/documents"
        >
          <FileCheck2 className="text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Review documents</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the shared review queue and record decisions.
          </p>
        </Link>
        <Link
          className="border border-border bg-card p-6 shadow-sm transition hover:border-primary"
          href="/customers"
        >
          <Users className="text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Customers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            View customer assignments and compliance context.
          </p>
        </Link>
      </div>
    </div>
  );
}

export default function StaffDashboardPage() {
  return (
    <StaffLayout>
      <StaffDashboardContent />
    </StaffLayout>
  );
}
