import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "@/components/data-table";
import type { ListQueryResult } from "@/lib/use-list-query";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

interface Row {
  id: string;
  name: string;
  total: string;
}

const columns: Column<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
  { id: "total", header: "Total", cell: (row) => row.total, sortKey: "totalPrice", align: "right" },
];

const rows: Row[] = [
  { id: "a", name: "Acme", total: "1200.00" },
  { id: "b", name: "Globex", total: "900.00" },
];

/** A ListQueryResult with everything stubbed, so each test overrides only what it is about. */
function state(overrides: Partial<ListQueryResult<Row>> = {}): ListQueryResult<Row> {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    sort: undefined,
    setSort: vi.fn(),
    setPage: vi.fn(),
    isLoading: false,
    isFetching: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderTable(overrides: Partial<ListQueryResult<Row>> = {}, extra = {}) {
  const resolved = state(overrides);
  render(
    <DataTable
      columns={columns}
      state={resolved}
      rowKey={(row) => row.id}
      emptyMessage="No quotations match these filters."
      noun="quotation"
      {...extra}
    />,
  );
  return resolved;
}

describe("DataTable", () => {
  it("renders a row per record", () => {
    renderTable();

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("900.00")).toBeInTheDocument();
    // Header row plus two data rows.
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows skeletons while loading and no empty message", () => {
    renderTable({ isLoading: true, rows: [], total: 0 });

    expect(screen.queryByText("No quotations match these filters.")).not.toBeInTheDocument();
    // An empty state during the first load would read as "there is no data".
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows the empty message once loaded with no rows", () => {
    renderTable({ rows: [], total: 0, totalPages: 0 });

    expect(screen.getByText("No quotations match these filters.")).toBeInTheDocument();
  });

  it("shows the error state and retries through refetch", async () => {
    const user = userEvent.setup();
    const resolved = renderTable({ isError: true, error: new Error("Network unreachable") });

    expect(screen.getByRole("alert")).toHaveTextContent("Network unreachable");
    // No table at all in the error state: a half-rendered table with an error above it
    // is how a stale page gets mistaken for a live one.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(resolved.refetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the noun when the error carries no message", () => {
    renderTable({ isError: true, error: { weird: true } });

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load quotations.");
  });

  it("makes only columns with a sortKey clickable", async () => {
    const user = userEvent.setup();
    const resolved = renderTable();

    await user.click(screen.getByRole("button", { name: /Total/ }));
    expect(resolved.setSort).toHaveBeenCalledWith("totalPrice");

    // "Name" has no sortKey, so it is plain header text, not a button.
    expect(screen.queryByRole("button", { name: /Name/ })).not.toBeInTheDocument();
  });

  it("marks the sorted column with aria-sort in the active direction", () => {
    const { unmount } = render(
      <DataTable
        columns={columns}
        state={state({ sort: "-totalPrice" })}
        rowKey={(row) => row.id}
        emptyMessage="none"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).not.toHaveAttribute("aria-sort");
    unmount();

    render(
      <DataTable
        columns={columns}
        state={state({ sort: "totalPrice" })}
        rowKey={(row) => row.id}
        emptyMessage="none"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("hides the pager on a single page", () => {
    renderTable({ totalPages: 1 });

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last", async () => {
    const user = userEvent.setup();
    const resolved = renderTable({ page: 1, totalPages: 3, total: 60 });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("60 quotations")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(resolved.setPage).toHaveBeenCalledWith(2);
  });

  it("disables both pager buttons while a page is in flight", () => {
    renderTable({ page: 2, totalPages: 3, isFetching: true });

    // Otherwise a double click skips a page.
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("renders an actions column only when actions are given", () => {
    const { unmount } = render(
      <DataTable
        columns={columns}
        state={state()}
        rowKey={(row) => row.id}
        emptyMessage="none"
        actions={(row) => <button type="button">Send {row.name}</button>}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Acme" })).toBeInTheDocument();
    unmount();

    renderTable();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("singularises the footer count", () => {
    renderTable({ total: 1, totalPages: 2 });
    expect(screen.getByText("1 quotation")).toBeInTheDocument();
  });
});
