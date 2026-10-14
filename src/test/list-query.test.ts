import { describe, expect, it } from "vitest";
import { normaliseList, sortRows, toQueryString } from "@/lib/list-query";

const params = { page: 2, pageSize: 10 };

describe("toQueryString", () => {
  it("emits pageSize, not limit", () => {
    // pageSize is what four of the five admin list endpoints require; limit is an alias
    // on quotations alone and is silently ignored everywhere else.
    expect(toQueryString({ page: 2, pageSize: 25 })).toBe("?page=2&pageSize=25");
  });

  it("drops blank and undefined filters", () => {
    const query = toQueryString({
      page: 1,
      pageSize: 25,
      filters: { status: "", role: undefined, isActive: "true" },
    });

    // A cleared filter must disappear rather than being sent as `status=`, which the
    // zod query schemas reject.
    expect(query).toBe("?page=1&pageSize=25&isActive=true");
  });

  it("includes sort only when set, and encodes filter values", () => {
    expect(toQueryString({ page: 1, pageSize: 25, sort: "-totalPrice" })).toContain(
      "sort=-totalPrice",
    );
    expect(toQueryString({ filters: { search: "a b&c" } })).toBe("?search=a+b%26c");
    expect(toQueryString({})).toBe("");
  });
});

describe("normaliseList", () => {
  it("normalises {data, pagination} — documents, invoices, paginated quotations", () => {
    const result = normaliseList<{ id: string }>(
      { data: [{ id: "q-1" }], pagination: { page: 2, pageSize: 10, total: 31, totalPages: 4 } },
      params,
    );

    expect(result).toEqual({
      rows: [{ id: "q-1" }],
      total: 31,
      page: 2,
      pageSize: 10,
      totalPages: 4,
    });
  });

  it("normalises {items, total, page, pageSize} — /admin/users, the odd one out", () => {
    const result = normaliseList<{ id: string }>(
      { items: [{ id: "u-1" }, { id: "u-2" }], total: 42, page: 3, pageSize: 20 },
      params,
    );

    // It sends no totalPages, so it is derived.
    expect(result).toMatchObject({ total: 42, page: 3, pageSize: 20, totalPages: 3 });
    expect(result.rows).toHaveLength(2);
  });

  it("gives a bare array a total of its own length", () => {
    const result = normaliseList<number>([1, 2, 3], { page: 1, pageSize: 2 });

    // A bare array carries no pagination, so the only honest total is what arrived.
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
    expect(result.rows).toEqual([1, 2, 3]);
  });

  it("falls back to the requested page and size when the response omits them", () => {
    const result = normaliseList<{ id: string }>({ data: [{ id: "a" }] }, params);
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
  });

  it("returns an empty list for a response that is not a list at all", () => {
    // `GET /admin/analytics` answers `{}`. Empty beats throwing: the screen shows its
    // empty state instead of the error boundary.
    expect(normaliseList({}, params)).toEqual({ ...params, rows: [], total: 0, totalPages: 0 });
    expect(normaliseList(null, params).rows).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = [
    { id: "b", totalPrice: "900.00" },
    { id: "a", totalPrice: "1200.50" },
    { id: "c", totalPrice: "80.00" },
  ];

  it("compares money strings numerically, not lexically", () => {
    // Lexically "80.00" > "1200.50", which would put the cheapest quotation last.
    expect(sortRows(rows, "totalPrice").map((row) => row.id)).toEqual(["c", "b", "a"]);
    expect(sortRows(rows, "-totalPrice").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("compares non-numeric values as strings and leaves rows alone with no sort", () => {
    expect(sortRows(rows, "id").map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, undefined)).toBe(rows);
  });

  it("sorts null and undefined to the end and does not mutate the input", () => {
    const withGaps = [{ v: 2 }, { v: null }, { v: 1 }];
    expect(sortRows(withGaps, "v").map((row) => row.v)).toEqual([1, 2, null]);
    expect(withGaps.map((row) => row.v)).toEqual([2, null, 1]);
  });
});
