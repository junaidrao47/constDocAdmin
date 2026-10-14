import type { QuotationStatus } from "./types";

/**
 * The legal moves, mirroring `FLOW` in
 * apps/api/src/modules/quotations/quotation-status.ts. An illegal move is a 409 from
 * the API, so offering one is offering a button that cannot work.
 *
 * The admin screen previously hardcoded two of these moves and omitted the rest,
 * which left reject, cancel and expire reachable only through a database client.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ["sent", "rejected", "cancelled"],
  sent: ["under_review", "accepted", "rejected", "expired", "cancelled"],
  under_review: ["accepted", "rejected", "expired"],
  accepted: ["converted"],
  rejected: [],
  expired: [],
  converted: [],
  cancelled: [],
};

/** Every status, for a filter dropdown. */
export const QUOTATION_STATUSES = Object.keys(QUOTATION_TRANSITIONS) as QuotationStatus[];

const LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
  cancelled: "Cancelled",
};

export function statusLabel(status: QuotationStatus): string {
  return LABELS[status] ?? status;
}

/** The button wording for a move, so "Send" reads better than "Mark as sent". */
const ACTIONS: Partial<Record<QuotationStatus, string>> = {
  sent: "Send",
  under_review: "Start review",
  accepted: "Accept",
  rejected: "Reject",
  expired: "Expire",
  converted: "Convert",
  cancelled: "Cancel quotation",
};

export function transitionLabel(to: QuotationStatus): string {
  return ACTIONS[to] ?? statusLabel(to);
}

/** A move that destroys value and cannot be undone gets the destructive treatment. */
export function isDestructive(to: QuotationStatus): boolean {
  return to === "rejected" || to === "cancelled" || to === "expired";
}
