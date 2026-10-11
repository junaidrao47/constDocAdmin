"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AdminDashboardPage() {
  const { session } = useAuth();
  return (
    <div className="p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        Administrator workspace
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Platform control center</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Welcome, {session?.user.name ?? session?.user.email}. Manage access and operational
        configuration from here.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          className="border border-border bg-card p-6 shadow-sm transition hover:border-primary"
          href="/admin/users"
        >
          <Users className="text-primary" />
          <h2 className="mt-5 text-lg font-semibold">User management</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create staff accounts and manage platform access.
          </p>
        </Link>
        <div className="border border-border bg-card p-6 shadow-sm">
          <ShieldCheck className="text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Access posture</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Admin-only controls are isolated from the staff review workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
