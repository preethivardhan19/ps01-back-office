import { TODAY } from "../data/seed";
import type { Bill, Invoice, Recurrence } from "../types";
import { addDays } from "./format";
import { isUnpaid } from "./invoices";

/** Supported forecast lengths in days. */
export type HorizonDays = 30 | 60 | 90;

/** A single expected inflow or outflow on a specific date. `amountINR` is always positive. */
export type CashEvent = {
  date: string;
  type: "invoice" | "bill";
  description: string;
  amountINR: number;
  direction: "in" | "out";
  sourceId: string;
};

/** One calendar day of the forecast with its aggregated flows and resulting closing balance. */
export type ForecastDay = {
  date: string;
  inflowINR: number;
  outflowINR: number;
  balanceINR: number;
  events: CashEvent[];
};

/** Full forecast: one row per day, a flat chronological ledger, and summary figures. */
export type CashForecast = {
  horizonDays: HorizonDays;
  startDate: string;
  days: ForecastDay[];
  events: CashEvent[];
  lowestBalanceINR: number;
  firstNegativeDate: string | null;
};

const VALID_HORIZONS: readonly number[] = [30, 60, 90];
const STEP_MONTHS: Record<Recurrence, number> = { "one-time": 0, monthly: 1, quarterly: 3, yearly: 12 };
const DIRECTION_ORDER = { in: 0, out: 1 } as const;

/**
 * Returns the occurrence of `dueDate` shifted by `monthsAhead` months.
 * The day-of-month is clamped to the last day of the target month (e.g. Jan 31 + 1 month = Feb 28/29).
 */
function occurrenceOn(dueDate: string, monthsAhead: number): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  const monthIndex = month - 1 + monthsAhead;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/**
 * Due dates of a bill that fall inside [startDate, endDate].
 * Occurrences before startDate are ignored, except that an overdue bill whose most recent
 * past occurrence predates startDate is expected on startDate instead.
 */
function billDates(bill: Bill, startDate: string, endDate: string): string[] {
  const step = STEP_MONTHS[bill.recurrence];
  const [dueYear, dueMonth] = bill.dueDate.split("-").map(Number);
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const monthsElapsed = (startYear - dueYear) * 12 + (startMonth - dueMonth);
  // Begin one step before the first possibly-relevant occurrence so the latest past one is seen.
  const firstIndex = step > 0 ? Math.max(0, Math.floor(monthsElapsed / step) - 1) : 0;

  const dates: string[] = [];
  let latestPast: string | null = null;
  // One-time bills (step 0) produce only occurrence 0.
  for (let index = firstIndex; step > 0 || index === 0; index++) {
    const date = occurrenceOn(bill.dueDate, index * step);
    if (date > endDate) break;
    if (date < startDate) {
      latestPast = date;
    } else {
      dates.push(date);
    }
  }

  if (bill.status === "overdue" && latestPast !== null) {
    dates.unshift(startDate);
  }
  return dates;
}

/**
 * Projects daily cash balances over `horizonDays` starting at `startDate`.
 *
 * - Inflows: unpaid invoices with status "sent" or "overdue". Any invoice due before startDate is expected on startDate.
 * - Outflows: bills not marked paid, expanded by recurrence (monthly/quarterly/yearly, day-of-month clamped).
 * - Within a day, events are ordered inflows first, then outflows, then by description.
 * - `lowestBalanceINR` is the minimum over all day balances AND the opening `currentCash`.
 * - `firstNegativeDate` is the first day whose balance is below zero, or null.
 * Pure: inputs are not mutated and "today" is never read from the clock.
 *
 * @throws {RangeError} if `horizonDays` is not 30, 60 or 90.
 */
export function calculateCashForecast(
  currentCash: number,
  invoices: Invoice[],
  bills: Bill[],
  horizonDays: HorizonDays,
  startDate: string = TODAY,
): CashForecast {
  if (!VALID_HORIZONS.includes(horizonDays)) {
    throw new RangeError(`Unsupported forecast horizon: ${horizonDays}. Expected 30, 60 or 90.`);
  }
  const endDate = addDays(startDate, horizonDays - 1);

  const invoiceEvents: CashEvent[] = invoices
    .filter((invoice) => isUnpaid(invoice) && (invoice.status === "sent" || invoice.status === "overdue"))
    .map(
      (invoice): CashEvent => ({
        date: invoice.dueDate < startDate ? startDate : invoice.dueDate,
        type: "invoice",
        description: invoice.description,
        amountINR: invoice.amountINR,
        direction: "in",
        sourceId: invoice.id,
      }),
    )
    .filter((event) => event.date <= endDate);

  const billEvents: CashEvent[] = bills
    .filter((bill) => bill.status !== "paid")
    .flatMap((bill) =>
      billDates(bill, startDate, endDate).map(
        (date): CashEvent => ({
          date,
          type: "bill",
          description: bill.name,
          amountINR: bill.amountINR,
          direction: "out",
          sourceId: bill.id,
        }),
      ),
    );

  const events = [...invoiceEvents, ...billEvents].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      DIRECTION_ORDER[a.direction] - DIRECTION_ORDER[b.direction] ||
      a.description.localeCompare(b.description),
  );

  const eventsByDate = new Map<string, CashEvent[]>();
  for (const event of events) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }

  const days: ForecastDay[] = [];
  let balanceINR = currentCash;
  for (let index = 0; index < horizonDays; index++) {
    const date = addDays(startDate, index);
    const dayEvents = eventsByDate.get(date) ?? [];
    const inflowINR = dayEvents
      .filter((event) => event.direction === "in")
      .reduce((total, event) => total + event.amountINR, 0);
    const outflowINR = dayEvents
      .filter((event) => event.direction === "out")
      .reduce((total, event) => total + event.amountINR, 0);
    balanceINR += inflowINR - outflowINR;
    days.push({ date, inflowINR, outflowINR, balanceINR, events: dayEvents });
  }

  return {
    horizonDays,
    startDate,
    days,
    events,
    lowestBalanceINR: Math.min(currentCash, ...days.map((day) => day.balanceINR)),
    firstNegativeDate: days.find((day) => day.balanceINR < 0)?.date ?? null,
  };
}
