import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "@/app/(admin)/admin/users/page";

const { apiRequest, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {}
  return { apiRequest: vi.fn(), FakeApiError };
});
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: FakeApiError,
  // Mirrors the real helper: only an ApiError contributes its own message.
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof FakeApiError ? error.message : fallback,
}));

const admin = {
  id: "u-admin",
  email: "admin@test.com",
  name: "Root Admin",
  role: "admin",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const agent = {
  ...admin,
  id: "u-agent",
  email: "agent@test.com",
  name: "Field Agent",
  role: "agent",
};

/**
 * The page makes two calls: the visible list, and a one-row count of active admins.
 * `adminTotal` is what that count reports; `rows` is what the list shows.
 */
function mockApi({ rows, adminTotal }: { rows: unknown[]; adminTotal?: number }) {
  // Defensive about the argument: an in-flight query from the previous test can reach
  // this implementation after the mock is reset.
  apiRequest.mockImplementation((path?: unknown) => {
    if (typeof path === "string" && path.includes("role=admin&isActive=true")) {
      return adminTotal === undefined
        ? new Promise(() => {}) // never resolves, standing in for a slow count
        : Promise.resolve({ items: [admin], total: adminTotal, page: 1, pageSize: 1 });
    }
    return Promise.resolve({ items: rows, total: rows.length, page: 1, pageSize: 20 });
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
}

/**
 * The Disable/Enable button in the desktop table row for a given account name.
 * Scoped to table rows: the mobile card list renders the same names in `<article>`s.
 */
function accessButton(name: string) {
  const row = screen.getAllByRole("row").find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`No row for ${name}`);
  return (
    row.querySelector("button") ??
    (() => {
      throw new Error(`No button in the row for ${name}`);
    })()
  );
}

beforeEach(() => apiRequest.mockReset());

describe("the last-admin guard", () => {
  it("asks the API how many active admins there are", async () => {
    mockApi({ rows: [admin, agent], adminTotal: 3 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/users?role=admin&isActive=true&page=1&pageSize=1",
    );
  });

  it("disables the sole admin even when the list holds many users", async () => {
    // Half one of the bug. The old guard compared the *filtered list* total to 1, so
    // with five rows in view it never fired and the only admin could be disabled —
    // locking the whole organisation out of the admin portal.
    const others = [2, 3, 4].map((n) => ({ ...agent, id: `u-${n}`, name: `Agent ${n}` }));
    mockApi({ rows: [admin, agent, ...others], adminTotal: 1 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    await waitFor(() => expect(accessButton("Root Admin")).toBeDisabled());
  });

  it("disables the button for the only remaining active admin", async () => {
    mockApi({ rows: [admin], adminTotal: 1 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    await waitFor(() => expect(accessButton("Root Admin")).toBeDisabled());
    expect(accessButton("Root Admin")).toHaveAttribute(
      "title",
      "The last active admin cannot be disabled.",
    );
  });

  it("leaves an admin enabled when a filter narrows the list to one row", async () => {
    // Half two of the bug, in the other direction: searching for a single admin made
    // the filtered total 1, so the guard fired against one of three admins who was
    // perfectly safe to disable.
    mockApi({ rows: [admin], adminTotal: 3 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    await waitFor(() => expect(accessButton("Root Admin")).toBeEnabled());
  });

  it("guards the mobile card too, which previously had no guard at all", async () => {
    mockApi({ rows: [admin], adminTotal: 1 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    // The card's button was gated on `pending` only, so on a phone the last admin was
    // always disableable regardless of what the table did.
    const card = screen.getByRole("article");
    await waitFor(() => expect(within(card).getByRole("button")).toBeDisabled());
  });

  it("leaves an already-disabled admin enabled so they can be restored", async () => {
    const disabledAdmin = { ...admin, id: "u-old", name: "Former Admin", isActive: false };
    mockApi({ rows: [disabledAdmin], adminTotal: 1 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Former Admin").length).toBeGreaterThan(0));
    // Blocking this would make a locked-out organisation permanent.
    expect(accessButton("Former Admin")).toBeEnabled();
  });

  it("holds the button disabled while the admin count is still unknown", async () => {
    mockApi({ rows: [admin], adminTotal: undefined });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Root Admin").length).toBeGreaterThan(0));
    // Failing safe: permitting the click until the count arrives is the lockout itself.
    expect(accessButton("Root Admin")).toBeDisabled();
  });
});
