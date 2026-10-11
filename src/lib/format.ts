/** Money is MXN unless a record carries its own currency. Mexican number format. */
export function formatMoney(value: number | string | null | undefined, currency = "MXN"): string {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
