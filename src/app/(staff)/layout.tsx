"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MobileNav } from "@/components/mobile-nav";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!session) {
    router.replace("/staff/login");
    return null;
  }
  if (session.user.role === "admin") {
    router.replace("/admin");
    return null;
  }
  if (session.user.role === "customer") {
    router.replace("/403");
    return null;
  }

  const role = session.user.role;
  const navItems = [
    { href: "/documents", label: "My Documents Queue", show: true },
    { href: "/customers", label: "My Customers", show: true },
    { href: "/oversight", label: "Oversight", show: role === "manager" },
    { href: "/quotations", label: "Quotations", show: true },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileNav items={navItems} />
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-primary text-primary-foreground lg:block">
          <div className="border-b border-primary-foreground/10 px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">ConstDoc</p>
            <p className="mt-1 text-sm text-primary-foreground/60">Operations console</p>
          </div>
          <nav className="space-y-1 px-3 py-5">
            {navItems.map((item) => (
              <Link
                className={`block border-l-2 px-3 py-2 text-sm ${pathname === item.href ? "border-accent bg-primary-foreground/10 text-primary-foreground" : "border-transparent text-primary-foreground/60 hover:text-primary-foreground"}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-0 w-full border-t border-primary-foreground/10 p-5">
            <p className="truncate text-sm font-medium">
              {session.user.name ?? session.user.email}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-accent">{role}</p>
            <button
              className="mt-5 text-xs text-primary-foreground/60 hover:text-primary-foreground"
              onClick={() => {
                logout();
                router.replace("/staff/login");
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-h-screen lg:pl-64">{children}</main>
      </div>
    </div>
  );
}
