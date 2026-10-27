import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  /**
   * Whether the route exists yet. `false` renders a dimmed non-link instead of a live
   * link to the 404 page; flip it in the same PR that adds the page.
   */
  ready: boolean;
  /** Restricts the item to these roles. Omitted means every role in that portal. */
  roles?: UserRole[];
}

/**
 * Admin sidebar, in the order the modules are worked through.
 *
 * Analytics reads the real `GET /admin/analytics/overview` (the bare `GET /admin/analytics`
 * stays a stub). Customers reads `GET /admin/customers` — the account-approval lifecycle,
 * separate from the raw `/admin/users` table.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", ready: true },
  { href: "/admin/analytics", label: "Analytics", ready: true },
  { href: "/admin/homepage", label: "Homepage hero", ready: true },
  { href: "/admin/content", label: "Site content", ready: true },
  { href: "/admin/quotations", label: "Quotations", ready: true },
  { href: "/admin/invoices", label: "Invoices", ready: false },
  { href: "/admin/documents", label: "Documents", ready: true },
  { href: "/admin/customers", label: "Customers", ready: true },
  { href: "/admin/categories", label: "Categories", ready: true },
  { href: "/admin/packages", label: "Packages", ready: true },
  { href: "/admin/services", label: "Services", ready: true },
  { href: "/admin/calculator", label: "Calculator & pricing", ready: true },
  { href: "/admin/settings", label: "Settings", ready: true },
  { href: "/admin/users", label: "Users", ready: true },
];

/**
 * Staff sidebar — a separate list, not a filtered admin one. Agents and managers work
 * a queue; they do not administer the platform.
 *
 * The labels are unchanged from the hand-written nav on purpose: `staff-layout.test.tsx`
 * asserts them, and renaming them here would be churn unrelated to this change.
 */
export const STAFF_NAV: NavItem[] = [
  { href: "/documents", label: "My Documents Queue", ready: true },
  { href: "/customers", label: "My Customers", ready: true },
  { href: "/oversight", label: "Oversight", ready: true, roles: ["manager"] },
  { href: "/quotations", label: "Quotations", ready: true },
];

/** Narrows a nav list to one role. An item with no `roles` is visible to all of them. */
export function navForRole(items: NavItem[], role: UserRole | undefined): NavItem[] {
  return items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)));
}
