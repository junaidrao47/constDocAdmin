"use client";

import Link from "next/link";
import { FileCheck2, Users } from "lucide-react";
import StaffLayout from "@/app/(staff)/layout";
import { useAuth } from "@/lib/auth-context";

function StaffDashboardContent() {
  const { session } = useAuth();

  return <div className="p-5 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Staff workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Good to see you, {session?.user.name ?? session?.user.email}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Keep customer compliance work moving from one focused queue.</p><div className="mt-8 grid gap-4 md:grid-cols-2"><Link className="border border-slate-200 bg-white p-6 shadow-sm transition hover:border-cyan-500" href="/documents"><FileCheck2 className="text-cyan-700" /><h2 className="mt-5 text-lg font-semibold">Review documents</h2><p className="mt-2 text-sm text-slate-500">Open the shared review queue and record decisions.</p></Link><Link className="border border-slate-200 bg-white p-6 shadow-sm transition hover:border-cyan-500" href="/customers"><Users className="text-cyan-700" /><h2 className="mt-5 text-lg font-semibold">Customers</h2><p className="mt-2 text-sm text-slate-500">View customer assignments and compliance context.</p></Link></div></div>;
}

export default function StaffDashboardPage() {
  return <StaffLayout><StaffDashboardContent /></StaffLayout>;
}