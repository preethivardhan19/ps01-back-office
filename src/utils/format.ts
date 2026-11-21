const MS_PER_DAY = 86_400_000;

/**
 * Formats an INR amount with ₹ and Indian digit grouping.
 * e.g. 1250000 -> "₹12,50,000", 125000 -> "₹1,25,000", -4500 -> "-₹4,500"
 */
export function formatINR(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const whole = Math.round(Math.abs(amount)).toString();

  if (whole.length <= 3) {
    return `${sign}₹${whole}`;
  }

  const last3 = whole.slice(-3);
  const head = whole.slice(0, -3);
  // Group the leading digits in pairs, e.g. "1250" -> "12,50".
  const grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${grouped},${last3}`;
}

/** Whole calendar days from `from` to `to` (both "YYYY-MM-DD"). Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / MS_PER_DAY);
}

/** Adds a number of calendar days to a "YYYY-MM-DD" date and returns "YYYY-MM-DD". */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Formats "YYYY-MM-DD" for display, e.g. "15 Jun 2025". */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
