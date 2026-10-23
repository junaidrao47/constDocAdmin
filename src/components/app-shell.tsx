"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import type { NavItem } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  items: NavItem[];
  /** Line under the Grupo G2H wordmark, e.g. "Control center". */
  subtitle: string;
  /** Who is signed in, shown at the foot of the sidebar. */
  userLabel: string;
  roleLabel: string;
  onSignOut: () => void;
  children: React.ReactNode;
}

/** A nav entry is current when it is the exact path or a parent of it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The sidebar, mobile nav and main column, shared by the admin and staff portals.
 *
 * Both layouts had their own near-identical copy of this markup, with the active-state
 * ternary written out once per link. Role guarding stays in each layout — this
 * component renders a chrome, it does not decide who may see it.
 */
export function AppShell({
  items,
  subtitle,
  userLabel,
  roleLabel,
  onSignOut,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileNav items={items} />
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-primary text-primary-foreground lg:flex">
        <div className="border-b border-primary-foreground/10 px-6 py-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
            Grupo <span className="text-primary-foreground">G2H</span>
          </p>
          <p className="mt-1 text-sm text-primary-foreground/60">{subtitle}</p>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {items.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "block border-l-2 px-3 py-2 text-sm",
                  isActive(pathname, item.href)
                    ? "border-accent bg-primary-foreground/10 text-primary-foreground"
                    : "border-transparent text-primary-foreground/60 hover:text-primary-foreground",
                )}
              >
                {item.label}
              </Link>
            ) : (
              // Not a link: the route does not exist yet, and a live link would land the
              // user on the 404 page.
              <span
                key={item.href}
                aria-disabled="true"
                title="Not available yet"
                className="block cursor-not-allowed border-l-2 border-transparent px-3 py-2 text-sm text-primary-foreground/30"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-primary-foreground/10 p-5">
          <p className="truncate text-sm font-medium">{userLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-accent">{roleLabel}</p>
          <button
            className="mt-5 text-xs text-primary-foreground/60 hover:text-primary-foreground"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-h-screen lg:pl-64">{children}</main>
    </div>
  );
}
