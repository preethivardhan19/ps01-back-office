import { TODAY } from "../data/seed";
import type { Bill, Invoice } from "../types";
import { addDays } from "./format";
import { calculateCashForecast } from "./cashForecast";
import type { CashForecast, HorizonDays } from "./cashForecast";

/** Maximum number of distinct clients the bad-day selection collects. */
const MAX_BAD_DAY_CLIENTS = 5;

/** Keeps only invoices that are still expected to be collected: status "sent" or "overdue". */
export function eligibleWhatIfInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((invoice) => invoice.status === "sent" || invoice.status === "overdue");
}

/** The date an invoice is expected to land: its due date, but never earlier than startDate. */
export function placementDate(invoice: Invoice, startDate: string): string {
  return invoice.dueDate < startDate ? startDate : invoice.dueDate;
}

/**
 * Picks the clients that would hurt most if they paid late.
 * Eligible invoices are ordered by placement date then id; distinct clients are collected in order
 * of first appearance, capped at five. `invoiceIds` covers every eligible invoice of those clients.
 */
export function badDaySelection(
  invoices: Invoice[],
  startDate: string,
): { clientIds: string[]; availableClientCount: number; invoiceIds: string[] } {
  const ordered = eligibleWhatIfInvoices(invoices)
    .slice()
    .sort((a, b) => {
      const byPlacement = placementDate(a, startDate) < placementDate(b, startDate) ? -1 : placementDate(a, startDate) > placementDate(b, startDate) ? 1 : 0;
      if (byPlacement !== 0) return byPlacement;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const allClientIds = new Set<string>();
  const clientIds: string[] = [];
  for (const invoice of ordered) {
    allClientIds.add(invoice.clientId);
    if (clientIds.length < MAX_BAD_DAY_CLIENTS && !clientIds.includes(invoice.clientId)) {
      clientIds.push(invoice.clientId);
    }
  }

  const selected = new Set(clientIds);
  const invoiceIds = ordered
    .filter((invoice) => selected.has(invoice.clientId))
    .map((invoice) => invoice.id);

  return { clientIds, availableClientCount: allClientIds.size, invoiceIds };
}

/**
 * Returns a new invoice array where each invoice with a positive delay has its due date pushed to
 * placementDate + delay. Other invoices are returned as the same object. Inputs are never mutated.
 */
export function applyDelays(
  invoices: Invoice[],
  delayByInvoiceId: Record<string, number>,
  startDate: string,
): Invoice[] {
  return invoices.map((invoice) => {
    const delay = delayByInvoiceId[invoice.id];
    if (!(delay > 0)) return invoice;
    return { ...invoice, dueDate: addDays(placementDate(invoice, startDate), delay) };
  });
}

/**
 * Baseline cash forecast recomputed with the given invoice delays applied.
 * When startDate is omitted, TODAY is used for shifting and the baseline default applies.
 */
export function simulateForecast(
  currentCash: number,
  invoices: Invoice[],
  bills: Bill[],
  horizonDays: HorizonDays,
  delayByInvoiceId: Record<string, number>,
  startDate?: string,
): CashForecast {
  if (startDate === undefined) {
    const shifted = applyDelays(invoices, delayByInvoiceId, TODAY);
    return calculateCashForecast(currentCash, shifted, bills, horizonDays);
  }
  const shifted = applyDelays(invoices, delayByInvoiceId, startDate);
  return calculateCashForecast(currentCash, shifted, bills, horizonDays, startDate);
}

/** The first forecast day whose balance is negative, with the shortfall as a positive amount. */
export function firstShortfall(forecast: CashForecast): { date: string; shortfallINR: number } | null {
  const day = forecast.days.find((entry) => entry.balanceINR < 0);
  if (!day) return null;
  return { date: day.date, shortfallINR: -day.balanceINR };
}
