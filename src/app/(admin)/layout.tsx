"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MobileNav } from "@/components/mobile-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (isLoading) return <div className="min-h-screen bg-[#f4f0e8]" />;
  if (!session) {
    router.replace("/admin/login");
    return null;
  }
  if (session.user.role !== "admin") {
    router.replace("/staff");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e8] text-slate-900">
      <MobileNav
        items={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/quotations", label: "Quotations" },
        ]}
      />
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-amber-900/15 bg-[#29231b] text-white lg:block">
        <div className="border-b border-white/10 px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">ConstDoc</p>
          <p className="mt-1 text-sm text-white/60">Control center</p>
        </div>
        <nav className="space-y-1 px-3 py-5">
          <Link
            className={`block border-l-2 px-3 py-2 text-sm ${pathname === "/admin" ? "border-amber-300 bg-white/10 text-white" : "border-transparent text-white/60 hover:text-white"}`}
            href="/admin"
          >
            Overview
          </Link>
          <Link
            className={`block border-l-2 px-3 py-2 text-sm ${pathname === "/admin/users" ? "border-amber-300 bg-white/10 text-white" : "border-transparent text-white/60 hover:text-white"}`}
            href="/admin/users"
          >
            User management
          </Link>
          <Link
            className={`block border-l-2 px-3 py-2 text-sm ${pathname.startsWith("/admin/quotations") ? "border-amber-300 bg-white/10 text-white" : "border-transparent text-white/60 hover:text-white"}`}
            href="/admin/quotations"
          >
            Quotations
          </Link>
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-5">
          <p className="truncate text-sm font-medium">{session.user.name ?? session.user.email}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-amber-300">administrator</p>
          <button
            className="mt-5 text-xs text-white/60 hover:text-white"
            onClick={() => {
              logout();
              router.replace("/admin/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-h-screen lg:pl-64">{children}</main>
    </div>
  );
}
