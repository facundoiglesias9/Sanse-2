export function formatCurrency(
  value: number | null | undefined,
  currency: "USD" | "ARS" = "ARS",
  decimals: number = 2 // Por defecto, 2 decimales
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}