import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, configureApiTokens, errorMessage } from "@/lib/api";

describe("errorMessage", () => {
  it("shows the API's own wording, which is written for a person", () => {
    const refused = new ApiError("Cannot move a quotation from draft to accepted", 409);
    expect(errorMessage(refused, "Something went wrong.")).toBe(
      "Cannot move a quotation from draft to accepted",
    );
  });

  it("hides a transport error behind the caller's wording", () => {
    // A dead API throws TypeError("Failed to fetch"). Showing that to a user puts the
    // browser's words in the UI; the real one stays in the console.
    expect(errorMessage(new TypeError("Failed to fetch"), "Unable to load quotations.")).toBe(
      "Unable to load quotations.",
    );
    expect(errorMessage(new Error("socket hang up"), "Unable to load quotations.")).toBe(
      "Unable to load quotations.",
    );
  });

  it("falls back for anything that is not an Error at all", () => {
    expect(errorMessage({ code: 500 }, "Unable to load quotations.")).toBe(
      "Unable to load quotations.",
    );
    expect(errorMessage(undefined, "Unable to load quotations.")).toBe(
      "Unable to load quotations.",
    );
  });
});

describe("ApiError", () => {
  it("carries the API's per-field messages so a form can place them", () => {
    const invalid = new ApiError("email: must be a valid email", 400, {
      code: "VALIDATION_FAILED",
      fieldErrors: { email: ["must be a valid email"] },
    });
    expect(invalid.fieldErrors?.email).toEqual(["must be a valid email"]);
    expect(invalid.code).toBe("VALIDATION_FAILED");
    expect(invalid.status).toBe(400);
  });
});

describe("API client", () => {
  afterEach(() => {
    configureApiTokens(null);
    vi.restoreAllMocks();
  });

  it("sends the access token and unwraps an API envelope", async () => {
    configureApiTokens({ getAccessToken: () => "access-token", refresh: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: { id: "doc-1" } }), { status: 200 }),
        ),
    );

    await expect(apiRequest<{ id: string }>("/documents")).resolves.toEqual({ id: "doc-1" });
    // The base origin comes from NEXT_PUBLIC_API_URL, which differs between local dev and CI,
    // so assert on the resolved path rather than a hardcoded origin.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/documents"),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("parses the nested error envelope into code, message and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: "Validation failed",
              details: { email: ["Enter a valid work email."] },
              requestId: "req-123",
            },
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(apiRequest("/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      requestId: "req-123",
      // The first field error becomes the headline message a form can show.
      message: "email: Enter a valid work email.",
      fieldErrors: { email: ["Enter a valid work email."] },
    });
  });

  it("refreshes once and retries a 401 response", async () => {
    const refresh = vi.fn().mockResolvedValue("new-token");
    configureApiTokens({ getAccessToken: () => "old-token", refresh });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "Expired" }), { status: 401 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: ["ok"] }), { status: 200 })),
    );

    await expect(apiRequest<string[]>("/documents")).resolves.toEqual(["ok"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
