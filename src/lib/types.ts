export type UserRole = "customer" | "agent" | "manager" | "admin";

export type DocumentStatus =
  "pending" | "under_review" | "approved" | "rejected" | "expiring_soon" | "expired";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface UserList {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/** The `{data, pagination}` shape documents, invoices and paginated quotations return. */
export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface DocumentRecord {
  id: string;
  customerId: string;
  serviceId: string | null;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  downloadUrl?: string;
}

export interface ApiErrorShape {
  message: string;
  status: number;
}

/** A pricing service, as `GET /admin/services` serialises it. */
export interface Service {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** The trimmed service shape embedded in a package's `services` array. */
export interface PackageServiceRef {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
}

/** A package, as `GET /admin/packages` serialises it. `price` is a number, not a string. */
export interface Package {
  id: string;
  name: string;
  type: string;
  price: number;
  durationDays: number;
  description: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  services: PackageServiceRef[];
  createdAt: string;
  updatedAt: string;
}
/**
 * All eight values the API's `quotation_status` can hold. This listed six until
 * now, so a converted or cancelled quotation was an unhandled status.
 * Mirrors `QuotationStatus` in apps/api/src/modules/quotations/quotation-status.ts.
 */
export type QuotationStatus =
  | "draft"
  | "sent"
  | "under_review"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted"
  | "cancelled";
export interface Quotation {
  id: string;
  customerId: string;
  totalPrice: string;
  currency?: string;
  status: QuotationStatus;
  workerCount: number;
  expiresAt: string | null;
  createdAt: string;
  customer?: User;
  rejectionReason?: string | null;
}
