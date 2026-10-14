"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ADMIN_NAV } from "@/components/nav-config";
import { useAuth } from "@/lib/auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const router = useRouter();

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!session) {
    router.replace("/admin/login");
    return null;
  }
  if (session.user.role !== "admin") {
    router.replace("/staff");
    return null;
  }

  return (
    <AppShell
      items={ADMIN_NAV}
      subtitle="Control center"
      userLabel={session.user.name ?? session.user.email}
      roleLabel="administrator"
      onSignOut={() => {
        logout();
        router.replace("/admin/login");
      }}
    >
      {children}
    </AppShell>
  );
}
