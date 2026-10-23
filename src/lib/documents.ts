"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import type { DocumentStatus, StatusContract, UserRole } from "./types";

/**
 * The document status contract, fetched once from `GET /documents/statuses`.
 *
 * This is the single source of truth for the flow: which statuses exist and which
 * transitions each role may perform. No screen hardcodes a status list or transition —
 * action buttons are derived from `allowedTransitions` below (PROJECT-BRIEF §10.3).
 */
export function useStatusContract() {
  return useQuery({
    queryKey: ["document-statuses"],
    queryFn: () => apiRequest<StatusContract>("/documents/statuses"),
    staleTime: 30 * 60 * 1000,
  });
}

/** The statuses `role` may move a document to from `from`, per the contract. */
export function allowedTransitions(
  contract: StatusContract | undefined,
  role: UserRole | undefined,
  from: DocumentStatus | undefined,
): DocumentStatus[] {
  if (!contract || !role || !from) return [];
  return contract.transitionsByRole[role]?.[from] ?? [];
}
