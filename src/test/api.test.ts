import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, configureApiTokens } from "@/lib/api";

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
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/documents",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer access-token");
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
