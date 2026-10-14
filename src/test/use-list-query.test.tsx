import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListQuery } from "@/lib/use-list-query";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: class ApiError extends Error {},
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Five rows, so a pageSize of 2 gives three pages. */
const locations = [
  { id: "1", city: "Monterrey", multiplier: 1.05, isActive: true },
  { id: "2", city: "Guadalajara", multiplier: 1.1, isActive: true },
  { id: "3", city: "CDMX", multiplier: 1.15, isActive: true },
  { id: "4", city: "Puebla", multiplier: 0.95, isActive: false },
  { id: "5", city: "Tijuana", multiplier: 1.2, isActive: true },
];

type Location = (typeof locations)[number];

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(locations);
});

describe("useListQuery in client mode", () => {
  it("fetches once with no page, pageSize or sort in the query string", async () => {
    const { result } = renderHook(
      () =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 2,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.total).toBe(5));

    // These endpoints support neither paging nor sorting; sending the params would
    // imply a contract they do not honour.
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/admin/locations");
  });

  it("slices the page in memory and keeps total at the full count", async () => {
    const { result } = renderHook(
      () =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 2,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.rows.map((row) => row.id)).toEqual(["1", "2"]);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["3", "4"]));

    // Page 3 is the short one.
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["5"]));
    expect(result.current.total).toBe(5);
    // Still one fetch: paging is entirely in memory.
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("sorts in memory and reverses on a second click of the same column", async () => {
    const { result } = renderHook(
      () =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 10,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(5));

    act(() => result.current.setSort("multiplier"));
    await waitFor(() => expect(result.current.sort).toBe("multiplier"));
    expect(result.current.rows.map((row) => row.id)).toEqual(["4", "1", "2", "3", "5"]);

    act(() => result.current.setSort("multiplier"));
    await waitFor(() => expect(result.current.sort).toBe("-multiplier"));
    expect(result.current.rows.map((row) => row.id)).toEqual(["5", "3", "2", "1", "4"]);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("narrows total with clientFilter, not just the visible slice", async () => {
    const { result } = renderHook(
      () =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 2,
          clientFilter: (row) => row.isActive,
        }),
      { wrapper },
    );

    // Filtering after paging would leave 5 rows' worth of pages over 4 rows of data,
    // so the filter has to run first.
    await waitFor(() => expect(result.current.total).toBe(4));
    expect(result.current.totalPages).toBe(2);
    expect(result.current.rows.every((row) => row.isActive)).toBe(true);
  });

  it("resets to page 1 when a filter changes", async () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 2,
          filters: { isActive: status },
        }),
      { wrapper, initialProps: { status: "true" } },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    apiRequest.mockResolvedValue([locations[3]]);
    rerender({ status: "false" });

    // Without the reset the user lands on page 3 of a one-row result: an empty screen
    // that reads as "no data".
    await waitFor(() => expect(result.current.page).toBe(1));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
  });

  it("resets to page 1 when the sort changes", async () => {
    const { result } = renderHook(
      () =>
        useListQuery<Location>({
          key: "locations",
          path: "/admin/locations",
          mode: "client",
          pageSize: 2,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    act(() => result.current.setSort("city"));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.rows.map((row) => row.city)).toEqual(["CDMX", "Guadalajara"]);
  });
});

describe("useListQuery in server mode", () => {
  it("sends page and pageSize and refetches on a page change", async () => {
    apiRequest.mockImplementation((path: string) =>
      Promise.resolve({
        data: path.includes("page=2") ? [{ id: "q-3" }] : [{ id: "q-1" }, { id: "q-2" }],
        pagination: { page: path.includes("page=2") ? 2 : 1, pageSize: 2, total: 3, totalPages: 2 },
      }),
    );

    const { result } = renderHook(
      () =>
        useListQuery<{ id: string }>({
          key: "quotations",
          path: "/admin/quotations",
          pageSize: 2,
          sort: "-createdAt",
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(apiRequest).toHaveBeenCalledWith("/admin/quotations?page=1&pageSize=2&sort=-createdAt");

    act(() => result.current.setPage(2));

    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["q-3"]));
    expect(apiRequest).toHaveBeenCalledWith("/admin/quotations?page=2&pageSize=2&sort=-createdAt");
    // The server's total wins in server mode — it knows about rows this page never saw.
    expect(result.current.total).toBe(3);
  });

  it("keeps the previous rows on screen while the next page loads", async () => {
    let resolveSecond: ((value: unknown) => void) | undefined;
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("page=2")) {
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      }
      return Promise.resolve({
        data: [{ id: "q-1" }],
        pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
      });
    });

    const { result } = renderHook(
      () =>
        useListQuery<{ id: string }>({
          key: "quotations",
          path: "/admin/quotations",
          pageSize: 1,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setPage(2));

    // placeholderData: the old row stays rather than the table flashing its skeleton.
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rows.map((row) => row.id)).toEqual(["q-1"]);

    await act(async () => {
      resolveSecond?.({
        data: [{ id: "q-2" }],
        pagination: { page: 2, pageSize: 1, total: 2, totalPages: 2 },
      });
    });
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["q-2"]));
  });
});
