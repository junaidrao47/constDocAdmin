"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { navForRole, STAFF_NAV } from "@/components/nav-config";
import { useAuth } from "@/lib/auth-context";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
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

  return (
    <AppShell
      items={navForRole(STAFF_NAV, role)}
      subtitle="Operations console"
      userLabel={session.user.name ?? session.user.email}
      roleLabel={role}
      onSignOut={() => {
        logout();
        router.replace("/staff/login");
      }}
    >
      {children}
    </AppShell>
  );
}
