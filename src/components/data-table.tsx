"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import type { ListQueryResult } from "@/lib/use-list-query";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * Makes the header clickable and sends this key as `sort`. Omit it and the column
   * is not sortable — only `/admin/quotations` accepts `sort` server-side, so most
   * columns legitimately have no key.
   */
  sortKey?: string;
  align?: "right";
  /** Drops the column below this breakpoint. Mobile is column priority, not a second layout. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  state: ListQueryResult<T>;
  rowKey: (row: T) => string;
  emptyMessage: string;
  /** Row-level buttons. Rendered in a trailing right-aligned column. */
  actions?: (row: T) => ReactNode;
  /** Singular noun for the footer count, e.g. "quotation". */
  noun?: string;
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

function columnClass<T>(column: Column<T>): string {
  return cn(
    column.align === "right" && "text-right",
    column.hideBelow && HIDE_BELOW[column.hideBelow],
  );
}

/**
 * The one table in this app. Every list screen uses it, so loading, empty and error
 * states cannot be forgotten on a page-by-page basis — which is how the three
 * hand-rolled tables it replaces each ended up with a different subset of them.
 */
export function DataTable<T>({
  columns,
  state,
  rowKey,
  emptyMessage,
  actions,
  noun = "result",
}: DataTableProps<T>) {
  const { rows, total, page, totalPages, sort, setSort, setPage, isLoading, isFetching, isError } =
    state;
  const columnCount = columns.length + (actions ? 1 : 0);

  if (isError) {
    return (
      <div
        role="alert"
        className="border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive"
      >
        <p className="font-semibold">{errorMessage(state.error, `Unable to load ${noun}s.`)}</p>
        <Button variant="outline" className="mt-4" onClick={() => state.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const active =
                  column.sortKey && (sort === column.sortKey || sort === `-${column.sortKey}`);
                const descending = active && sort?.startsWith("-");

                return (
                  <TableHead
                    key={column.id}
                    className={columnClass(column)}
                    aria-sort={active ? (descending ? "descending" : "ascending") : undefined}
                  >
                    {column.sortKey ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                        onClick={() => setSort(column.sortKey as string)}
                      >
                        {column.header}
                        {active ? (
                          descending ? (
                            <ArrowDown size={13} />
                          ) : (
                            <ArrowUp size={13} />
                          )
                        ) : (
                          <ChevronsUpDown size={13} className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              [0, 1, 2, 3, 4].map((index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: columnCount }).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={columnClass(column)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {!isLoading && rows.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span aria-live="polite">
            {total} {noun}
            {total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="px-1">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
