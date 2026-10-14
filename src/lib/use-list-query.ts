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
   */
  clientFilter?: (row: T) => boolean;
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
    enabled,
  } = options;
  const resolvedPageSize = pageSize ?? 25;

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>(initialSort);

  // Page 2 of a filter that now matches three rows is an empty screen that reads as
  // "no data". Reset to the first page whenever the result set changes underneath us.
  const signature = `${JSON.stringify(filters ?? {})}|${sort ?? ""}`;
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

  const list = useMemo<NormalisedList<T>>(() => {
    if (query.data === undefined) {
      return { rows: [], total: 0, page, pageSize: resolvedPageSize, totalPages: 0 };
    }

    const normalised = normaliseList<T>(query.data, {
      page,
      pageSize: resolvedPageSize,
      sort,
      filters,
    });
    if (mode === "server") return normalised;

    const filtered = clientFilter ? normalised.rows.filter(clientFilter) : normalised.rows;
    const ordered = sortRows(filtered, sort);
    const start = (page - 1) * resolvedPageSize;

    return {
      rows: ordered.slice(start, start + resolvedPageSize),
      total: filtered.length,
      page,
      pageSize: resolvedPageSize,
      totalPages: Math.ceil(filtered.length / resolvedPageSize),
    };
    // `filters` is only read for normalisation defaults; its identity changes every
    // render, so the stable signature stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, mode, page, resolvedPageSize, sort, clientFilter, signature]);

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
