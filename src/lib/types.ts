export type UserRole = "customer" | "agent" | "manager" | "admin";

export type DocumentStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "expiring_soon"
  | "expired";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
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