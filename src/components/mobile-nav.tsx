"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile navigation"
      className="border-b border-white/10 bg-[#29231b] px-3 py-2 text-white lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-white/15 text-white" : "text-white/65"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
