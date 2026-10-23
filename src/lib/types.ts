export type UserRole = "customer" | "agent" | "manager" | "admin";

export type DocumentStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "submitted_to_government"
  | "rejected"
  | "expiring_soon"
  | "expired";

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
  requirementId?: string | null;
  currentVersionId?: string | null;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  downloadUrl?: string;
  approvedFileName?: string | null;
  approvedS3Key?: string | null;
  approvedUploadedAt?: string | null;
}

export type DocumentVersionKind = "customer" | "staff_on_behalf" | "official";

/** One uploaded file for a document, as `GET /documents/:id/versions` serialises it. */
export interface DocumentVersion {
  id: string;
  versionNo: number;
  kind: DocumentVersionKind;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  uploadedByRole: string;
  status: "intent" | "ready";
  createdAt: string;
}

/** A row from `GET /documents/:id/history`. */
export interface DocumentHistoryEntry {
  id: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
  note: string | null;
  createdAt: string;
  changedBy: { id: string; name?: string | null; email: string } | null;
}

/** The payload of `GET /documents/statuses` — the single source of truth for the flow. */
export interface StatusContract {
  statuses: { value: DocumentStatus; key: string; terminal: boolean }[];
  transitionsByRole: Record<string, Partial<Record<DocumentStatus, DocumentStatus[]>>>;
}

/** A required-documents checklist item, as the admin requirement endpoints serialise it. */
export interface Requirement {
  id: string;
  serviceId: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
  isRequired: boolean;
  sortOrder: number;
  allowedMimeTypes: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

/** A service/package category, as `GET /admin/categories` serialises it. */
export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
  icon: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiErrorShape {
  message: string;
  status: number;
  code?: string;
  requestId?: string;
}

/** The category reference embedded on a service/package. */
export interface CategoryRef {
  id: string;
  slug: string;
  nameEn?: string;
  nameEs?: string;
  name?: string;
}

/** A pricing service, as `GET /admin/services` serialises it. */
export interface Service {
  id: string;
  name: string;
  nameEn?: string | null;
  nameEs?: string | null;
  description: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
  basePrice: number;
  categoryId?: string | null;
  category?: CategoryRef | null;
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
  nameEn?: string | null;
  nameEs?: string | null;
  type: string;
  price: number;
  durationDays: number;
  description: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
  categoryId?: string | null;
  category?: CategoryRef | null;
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
