import { ApiError } from "./api";

/**
 * Stable API error code -> user-facing message.
 *
 * The API returns a machine `code` (see the backend `docs/error-codes.md`) alongside a
 * developer-oriented English `message`. Screens branch and display on `code`, never on
 * the English sentence. next-intl is not wired into this app yet, so this map is the
 * sanctioned fallback (PROJECT-BRIEF admin brief §1): English for now, one file to swap
 * for `t(code)` the day next-intl lands — the keys are already the codes.
 */
export const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: "Some fields need attention. Check the highlighted inputs.",
  BAD_REQUEST: "That request could not be processed.",
  MALFORMED_JSON: "The request was malformed. Please try again.",
  NOTE_REQUIRED: "A note of at least 5 characters is required.",
  UPLOAD_INCOMPLETE: "The upload did not finish. Please try again.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "We could not find what you were looking for.",
  CONFLICT: "That change conflicts with the current state. Refresh and try again.",
  CATEGORY_NOT_FOUND: "The selected category no longer exists.",
  CATEGORY_INACTIVE: "That category is deactivated. Reactivate it or pick another.",
  CATEGORY_NOT_EMPTY: "This category still has services or packages. Deactivate it instead of deleting.",
  INVALID_STATUS_TRANSITION: "That status change is not allowed from the document's current state.",
  DOCUMENT_LOCKED: "This document is locked in its current status and cannot take a new file.",
  NOT_ENTITLED: "That action is not available for this document yet.",
  UPLOAD_EXPIRED: "The upload window expired. Start the upload again.",
  FILE_TOO_LARGE: "That file is larger than the 25 MB limit.",
  FILE_TYPE_NOT_ALLOWED: "That file type is not accepted.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  SERVICE_UNAVAILABLE: "A required service is temporarily unavailable. Please try again shortly.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
};

/**
 * The message to show a user for any thrown value.
 *
 * Prefers a mapped message for the API's `code`, then the API's own human message, then
 * the caller's fallback. A dead network throws a `TypeError("Failed to fetch")` — that is
 * the browser talking to a developer, so it gets the fallback, not surfaced verbatim.
 */
export function messageForError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
    if (error.message) return error.message;
  }
  return fallback;
}
