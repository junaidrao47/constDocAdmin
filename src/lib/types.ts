export type UserRole = "customer" | "agent" | "manager" | "admin";

export type AccountStatus = "pending_approval" | "approved" | "suspended";
export type UserLocale = "en" | "es-MX";

/** One row of `GET /admin/customers`. persona/city come from the onboarding profile (null until onboarded). */
export interface AdminCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  accountStatus: AccountStatus;
  preferredLocale: UserLocale;
  managerId: string | null;
  persona: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCustomerList {
  items: AdminCustomer[];
  total: number;
  page: number;
  pageSize: number;
}

/** A manager option with their current assigned-customer count, from `GET /admin/managers`. */
export interface ManagerSummary {
  id: string;
  name: string | null;
  email: string;
  customerCount: number;
}

/** The onboarding profile, as `GET /customers/me/onboarding` and the manager detail serialise it. */
export interface Onboarding {
  persona: string | null;
  legalName: string | null;
  contactName: string | null;
  notificationEmails: string[];
  phone: string | null;
  state: string | null;
  city: string | null;
  needs: string[];
  completedAt: string | null;
  completed: boolean;
}

export interface PhaseProgress {
  completed: number;
  total: number;
  percent: number;
}

/** A row of the manager "my customers" list, `GET /manager/customers`. */
export interface ManagerCustomerListItem {
  id: string;
  email: string;
  name: string | null;
  accountStatus: AccountStatus;
  documentsCount: number;
  pendingDocuments: number;
  progress: PhaseProgress;
}

export interface ManagerCustomerDocument {
  id: string;
  fileName: string;
  status: DocumentStatus;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  progress: PhaseProgress;
}

export interface TimelineEntry {
  type: "document_status" | "phase";
  documentId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  at: string;
}

/** `GET /manager/customers/:id` — full customer profile for the staff workspace. */
export interface ManagerCustomerDetail {
  customer: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    accountStatus: AccountStatus;
    preferredLocale: UserLocale;
    managerId: string | null;
  };
  onboarding: Onboarding;
  subscriptions: Array<{
    id: string;
    packageId: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }>;
  documents: ManagerCustomerDocument[];
  timeline: TimelineEntry[];
}

export type PhaseStatus = "not_started" | "in_progress" | "completed" | "rejected";

/** One approval phase of a document, as `serializePhase` returns it. */
export interface DocumentPhase {
  id: string;
  documentId: string;
  position: number;
  nameEn: string;
  nameEs: string;
  department: string | null;
  targetDate: string | null;
  status: PhaseStatus;
  completedAt: string | null;
  completedBy: string | null;
  note: string | null;
  resultVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /documents/phases/statuses` — the single source of truth for the phase flow. */
export interface PhaseStatusContract {
  statuses: { value: PhaseStatus; key: string; terminal: boolean }[];
  /**
   * The phase transition map. Phase transitions are NOT role-scoped on the backend — the
   * route authorizes manager/admin, and both may make any allowed transition — so this is a
   * single `from → [to]` map (`GET /documents/phases/statuses` → `flow`), not keyed by role.
   */
  flow: Partial<Record<PhaseStatus, PhaseStatus[]>>;
}

/** `GET /documents/:id` detail, which now carries phases + progress + the document target date. */
export interface DocumentDetail extends DocumentRecord {
  targetDate: string | null;
  phases: DocumentPhase[];
  progress: PhaseProgress;
}

/** The intent response shared by every upload pipeline (`buildUploadTarget`). */
export interface UploadTarget {
  uploadMode: "s3" | "local";
  versionId: string;
  upload: { method: string; url: string; fields: Record<string, string> };
}

/** `GET /admin/analytics/overview` (§11.9). */
export interface AnalyticsOverview {
  range: { from: string; to: string };
  customersByStatus: { status: string; count: number }[];
  registrationsOverTime: { day: string; count: number }[];
  documentsByStatus: { status: string; count: number }[];
  averagePhaseDurationSeconds: number;
  documentsWaitingPerManager: { managerId: string; managerEmail: string; waiting: number }[];
  quotationsFunnel: { status: string; count: number }[];
  revenue: { currency: string; total: number };
  emails: { status: string; count: number }[];
}

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
  /** The customer's display name, attached by the staff review queue so the UI shows a person. */
  customerName?: string | null;
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
  imageUrl?: string | null;
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
