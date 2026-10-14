"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { apiRequest } from "./api";
import { normaliseList, sortRows, toQueryString, type NormalisedList } from "./list-query";

export type ListMode = "server" | "client";

export interface UseListQueryOptions<T> {
  /** React Query key prefix. Filters, page and sort are appended automatically. */
  key: string;
  /** Path after the API base, e.g. `/admin/quotations`. */
  path: string;
  /**
   * `server` sends page/pageSize/sort and trusts the response's pagination.
   * `client` fetches once and sorts, filters and slices in memory — for the five
   * reference endpoints (services, industries, locations, worker ranges, packages)
   * that return a bare array and support neither pagination nor sorting.
   */
  mode?: ListMode;
  pageSize?: number;
  /** Initial sort, e.g. `-createdAt`. Only quotations accept `sort` server-side. */
  sort?: string;
  /** Server-side filters. Blank values are dropped from the query string. */
  filters?: Record<string, string | undefined>;
  /**
   * In-memory narrowing, client mode only. Applied before paging, so it narrows
   * `total` rather than punching holes in one page.
   *
   * Pass `clientFilterKey` alongside it, or a narrowing applied while the user is on a
   * later page will clamp them to the last page instead of returning them to the first.
   */
  clientFilter?: (row: T) => boolean;
  /**
   * A stable description of what `clientFilter` currently matches — typically the search
   * term. Changing it resets to page 1, exactly as changing a server filter does.
   *
   * It exists because `clientFilter` is usually an inline arrow whose identity changes
   * every render, so the function itself cannot be compared.
   */
  clientFilterKey?: string;
  enabled?: boolean;
}

export interface ListQueryResult<T> extends NormalisedList<T> {
  sort: string | undefined;
  /** Toggles direction when the same key is clicked again. Resets to page 1. */
  setSort: (sortKey: string) => void;
  setPage: (page: number) => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useListQuery<T>(options: UseListQueryOptions<T>): ListQueryResult<T> {
  const {
    key,
    path,
    mode = "server",
    pageSize,
    sort: initialSort,
    filters,
    clientFilter,
    clientFilterKey,
    enabled,
  } = options;
  const resolvedPageSize = pageSize ?? 25;

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>(initialSort);

  // Page 2 of a filter that now matches three rows is an empty screen that reads as
  // "no data". Reset to the first page whenever the result set changes underneath us.
  const signature = `${JSON.stringify(filters ?? {})}|${sort ?? ""}|${clientFilterKey ?? ""}`;
  const previousSignature = useRef(signature);
  if (previousSignature.current !== signature) {
    previousSignature.current = signature;
    if (page !== 1) setPage(1);
  }

  const serverParams = { page, pageSize: resolvedPageSize, sort, filters };
  // Client mode asks for the whole list: these endpoints ignore page and sort, and
  // sending them would imply a contract they do not honour.
  const queryString = mode === "server" ? toQueryString(serverParams) : toQueryString({ filters });

  const query = useQuery({
    queryKey: [key, mode, queryString],
    queryFn: () => apiRequest<unknown>(`${path}${queryString}`),
    // Keeps the previous page's rows on screen while the next one loads, so paging
    // does not flash the skeleton.
    placeholderData: (previous) => previous,
    enabled,
  });

  /**
   * Server mode trusts the response. Client mode filters and sorts the whole list here;
   * the page slice is taken afterwards, once the page has been clamped into range.
   */
  const resolved = useMemo(() => {
    if (query.data === undefined) return null;

    const normalised = normaliseList<T>(query.data, {
      page,
      pageSize: resolvedPageSize,
      sort,
      filters,
    });
    if (mode === "server") return { server: normalised, rows: null, total: 0 };

    const filtered = clientFilter ? normalised.rows.filter(clientFilter) : normalised.rows;
    return { server: null, rows: sortRows(filtered, sort), total: filtered.length };
    // `filters` is only read for normalisation defaults; its identity changes every
    // render, so the stable signature stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, mode, page, resolvedPageSize, sort, clientFilter, signature]);

  const totalPages = resolved
    ? (resolved.server?.totalPages ?? Math.ceil(resolved.total / resolvedPageSize))
    : 0;

  /**
   * A result set that shrank beneath the current page leaves an empty table — and
   * because the pager hides itself at a single page, no way back to the rows. Clamping
   * catches every cause: an in-memory filter narrowing, rows deleted by someone else,
   * a server page count that fell.
   */
  if (totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }

  const list: NormalisedList<T> = (() => {
    if (!resolved) return { rows: [], total: 0, page, pageSize: resolvedPageSize, totalPages: 0 };
    if (resolved.server) return resolved.server;

    const safePage = Math.min(page, Math.max(1, totalPages));
    const start = (safePage - 1) * resolvedPageSize;
    return {
      rows: (resolved.rows ?? []).slice(start, start + resolvedPageSize),
      total: resolved.total,
      page: safePage,
      pageSize: resolvedPageSize,
      totalPages,
    };
  })();

  return {
    ...list,
    sort,
    setSort: (sortKey: string) =>
      setSort((current) => (current === sortKey ? `-${sortKey}` : sortKey)),
    setPage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
