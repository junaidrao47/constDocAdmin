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
 * Dashboard deliberately calls no API: `GET /admin/analytics` is a stub returning `{}`
 * and the backend CLAUDE.md says not to build UI on it, so the page stays link cards
 * until the real endpoints land.
 *
 * Customers will read `/admin/users?role=customer`. There is no `/admin/customers`
 * endpoint — customer records live in the users table.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", ready: true },
  { href: "/admin/quotations", label: "Quotations", ready: true },
  { href: "/admin/invoices", label: "Invoices", ready: false },
  { href: "/admin/documents", label: "Documents", ready: false },
  { href: "/admin/customers", label: "Customers", ready: false },
  { href: "/admin/packages", label: "Packages", ready: false },
  { href: "/admin/services", label: "Services", ready: false },
  { href: "/admin/industries", label: "Industries", ready: false },
  { href: "/admin/worker-ranges", label: "Worker ranges", ready: false },
  { href: "/admin/locations", label: "Locations", ready: false },
  { href: "/admin/settings", label: "Settings", ready: false },
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
