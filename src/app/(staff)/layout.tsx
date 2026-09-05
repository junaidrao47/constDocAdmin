"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (isLoading) return <div className="min-h-screen bg-[#f4f7f8]" />;
  if (!session) {
    router.replace("/login");
    return null;
  }
  if (session.user.role === "customer" || (pathname.startsWith("/admin") && session.user.role !== "admin")) {
    router.replace("/403");
    return null;
  }

  const role = session.user.role;
  const navItems = [
    { href: "/documents", label: "My Documents Queue", show: true },
    { href: "/customers", label: "My Customers", show: true },
    { href: "/oversight", label: "Oversight", show: role === "manager" || role === "admin" },
    { href: "/admin", label: "Administration", show: role === "admin" },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-[#10252b] text-white lg:block">
        <div className="border-b border-white/10 px-6 py-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">ConstDoc</p><p className="mt-1 text-sm text-white/60">Operations console</p></div>
        <nav className="space-y-1 px-3 py-5">{navItems.map((item) => <Link className={`block border-l-2 px-3 py-2 text-sm ${pathname === item.href ? "border-cyan-300 bg-white/10 text-white" : "border-transparent text-white/60 hover:text-white"}`} href={item.href} key={item.href}>{item.label}</Link>)}</nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-5"><p className="truncate text-sm font-medium">{session.user.firstName ?? session.user.email}</p><p className="mt-1 text-xs uppercase tracking-wider text-cyan-300">{role}</p><button className="mt-5 text-xs text-white/60 hover:text-white" onClick={() => { logout(); router.replace("/login"); }}>Sign out</button></div>
      </aside>
      <main className="min-h-screen lg:pl-64">{children}</main>
    </div>
  );
}
