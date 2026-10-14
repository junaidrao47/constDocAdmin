/**
 * One list contract for four different API shapes.
 *
 * The admin API did not grow its list endpoints at the same time, so they disagree:
 *
 *   GET /admin/users                      {items, total, page, pageSize}
 *   GET /admin/documents, /admin/invoices {data, pagination:{page,pageSize,total,totalPages}}
 *   GET /admin/quotations                 a bare array, unless a page param is sent
 *   GET /admin/services, /locations, ...  a bare array, always
 *
 * Every table in this app reads `NormalisedList` instead, so a page never has to know
 * which of the four it is talking to and a later backend unification changes only this file.
 */

/** `pageSize` is canonical. `limit` is an alias on quotations alone and is ignored elsewhere. */
export interface ListParams {
  page: number;
  pageSize: number;
  sort?: string;
  /** Endpoint-specific filters (status, role, isActive, customerId...). Blank values are dropped. */
  filters?: Record<string, string | undefined>;
}

export interface NormalisedList<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Builds the query string, omitting anything blank so a cleared filter disappears from
 * the URL rather than being sent as `status=`, which these endpoints reject.
 */
export function toQueryString(params: Partial<ListParams>): string {
  const search = new URLSearchParams();

  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));
  if (params.sort) search.set("sort", params.sort);

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value !== undefined && value !== "") search.set(key, value);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

function pageCount(total: number, pageSize: number): number {
  return pageSize > 0 ? Math.ceil(total / pageSize) : 0;
}

/**
 * Collapses whichever shape came back into `NormalisedList`.
 *
 * `params` supplies page and pageSize for the shapes that do not echo them — a bare
 * array carries no pagination at all, so its total is its own length.
 */
export function normaliseList<T>(payload: unknown, params: ListParams): NormalisedList<T> {
  const { page, pageSize } = params;

  if (Array.isArray(payload)) {
    const rows = payload as T[];
    return {
      rows,
      total: rows.length,
      page,
      pageSize,
      totalPages: pageCount(rows.length, pageSize),
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    // {data, pagination} — documents, invoices, assignments, and quotations when paginating.
    if (Array.isArray(record.data)) {
      const rows = record.data as T[];
      const pagination = (record.pagination ?? {}) as Partial<NormalisedList<T>>;
      const total = pagination.total ?? rows.length;
      const resolvedPageSize = pagination.pageSize ?? pageSize;
      return {
        rows,
        total,
        page: pagination.page ?? page,
        pageSize: resolvedPageSize,
        totalPages: pagination.totalPages ?? pageCount(total, resolvedPageSize),
      };
    }

    // {items, total, page, pageSize} — /admin/users, the odd one out.
    if (Array.isArray(record.items)) {
      const rows = record.items as T[];
      const total = typeof record.total === "number" ? record.total : rows.length;
      const resolvedPageSize = typeof record.pageSize === "number" ? record.pageSize : pageSize;
      return {
        rows,
        total,
        page: typeof record.page === "number" ? record.page : page,
        pageSize: resolvedPageSize,
        totalPages: pageCount(total, resolvedPageSize),
      };
    }
  }

  // Not a list. Returning empty rather than throwing keeps a malformed response on the
  // empty state instead of the error boundary, but the caller still sees total 0.
  return { rows: [], total: 0, page, pageSize, totalPages: 0 };
}

/** Applies a `sort` key (`totalPrice` / `-totalPrice`) in memory, for client-mode tables. */
export function sortRows<T>(rows: T[], sort: string | undefined): T[] {
  if (!sort) return rows;

  const descending = sort.startsWith("-");
  const key = descending ? sort.slice(1) : sort;

  return [...rows].sort((left, right) => {
    const a = (left as Record<string, unknown>)[key];
    const b = (right as Record<string, unknown>)[key];
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;

    // Money arrives as a decimal string, so compare numerically when both sides are numeric.
    const numericA = typeof a === "number" ? a : Number(a);
    const numericB = typeof b === "number" ? b : Number(b);
    const comparison =
      Number.isFinite(numericA) && Number.isFinite(numericB)
        ? numericA - numericB
        : String(a).localeCompare(String(b));

    return descending ? -comparison : comparison;
  });
}
