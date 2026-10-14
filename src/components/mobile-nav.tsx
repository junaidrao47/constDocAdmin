"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="border-b border-primary-foreground/10 bg-primary px-3 py-2 text-primary-foreground lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto">
        {items.map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-xs font-semibold",
                isActive(pathname, item.href)
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "text-primary-foreground/65",
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.href}
              aria-disabled="true"
              className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-primary-foreground/30"
            >
              {item.label}
            </span>
          ),
        )}
      </div>
    </nav>
  );
}
