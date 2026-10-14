import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "@/lib/format";

/** Intl inserts a narrow no-break space, so compare on digits and the symbol. */
function normalise(value: string): string {
  return value.replace(/ | /g, " ");
}

describe("formatMoney", () => {
  it("defaults to MXN when the record carries no currency", () => {
    // The client is Mexican; MXN is the product default and must never be another one.
    expect(normalise(formatMoney("1200.50"))).toBe("$1,200.50");
  });

  it("uses the currency the record carries, rather than a hardcoded symbol", () => {
    // Currency comes off the row because the API sends it per quotation and invoice.
    expect(normalise(formatMoney("1200.50", "USD"))).toContain("1,200.50");
    expect(normalise(formatMoney("1200.50", "USD"))).not.toBe(normalise(formatMoney("1200.50")));
  });

  it("accepts the decimal strings the API actually sends", () => {
    // Money crosses the wire as a string so cents survive; Number() happens here.
    expect(normalise(formatMoney("0.00"))).toBe("$0.00");
    expect(normalise(formatMoney(980))).toBe("$980.00");
  });

  it("renders zero rather than NaN for a missing or unparseable amount", () => {
    // A NaN in a money column is the kind of thing that reaches a customer invoice.
    expect(normalise(formatMoney(null))).toBe("$0.00");
    expect(normalise(formatMoney(undefined))).toBe("$0.00");
    expect(normalise(formatMoney("not-a-number"))).toBe("$0.00");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp and a Date the same way", () => {
    expect(formatDate("2026-10-14T09:30:00.000Z")).toBe("14 Oct 2026");
    expect(formatDate(new Date("2026-01-02T00:00:00.000Z"))).toBe("02 Jan 2026");
  });

  it("returns a dash for a missing date instead of Invalid Date", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });
});
