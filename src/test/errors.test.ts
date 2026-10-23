import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { CODE_MESSAGES, messageForError } from "@/lib/errors";

describe("messageForError", () => {
  it("prefers the mapped message for a known API code", () => {
    const error = new ApiError("Category still in use", 409, { code: "CATEGORY_NOT_EMPTY" });
    expect(messageForError(error, "fallback")).toBe(CODE_MESSAGES.CATEGORY_NOT_EMPTY);
  });

  it("falls back to the API's own message when the code is unmapped", () => {
    const error = new ApiError("Something specific the API said", 400, { code: "SOME_NEW_CODE" });
    expect(messageForError(error, "fallback")).toBe("Something specific the API said");
  });

  it("uses the caller fallback for a non-ApiError (e.g. a dead network)", () => {
    expect(messageForError(new TypeError("Failed to fetch"), "Could not load.")).toBe(
      "Could not load.",
    );
    expect(messageForError(undefined, "Could not load.")).toBe("Could not load.");
  });

  it("maps the document-pipeline codes", () => {
    for (const code of ["DOCUMENT_LOCKED", "NOT_ENTITLED", "UPLOAD_EXPIRED", "FILE_TYPE_NOT_ALLOWED"]) {
      expect(CODE_MESSAGES[code]).toBeTruthy();
    }
  });
});
