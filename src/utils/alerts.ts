import type { Bill, CashAccount, Client, Invoice } from "../types";
import { calculateCashForecast } from "./cashForecast";
import type { HorizonDays } from "./cashForecast";
import { addDays, daysBetween, formatDate, formatINR } from "./format";
import { firstShortfall } from "./whatIfForecast";

export type AlertPriority = "critical" | "high" | "medium" | "low";

export type AlertAction = { kind: "invoice"; invoiceId: string } | { kind: "forecast" };

export interface Alert {
  id: string; // deterministic: "forecast-negative", "invoice-overdue-<invoiceId>", "invoice-due-<invoiceId>", "bill-<billId>"
  priority: AlertPriority;
  title: string;
  message: string;
  actionLabel: string;
  action: AlertAction;
  date: string | null;
}

export interface AlertInputs {
  today: string;
  invoices: Invoice[];
  bills: Bill[];
  clients: Client[];
  cashAccounts: CashAccount[];
}

export const BILL_HIGH_DAYS = 7;
export const BILL_MEDIUM_DAYS = 30;
export const INVOICE_DUE_MEDIUM_DAYS = 14;
export const FORECAST_HORIZON_DAYS: HorizonDays = 90;

const PRIORITY_RANK: Record<AlertPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const INVOICE_ACTION_LABEL = "Open reminder";
const FORECAST_ACTION_LABEL = "View cash forecast";

function clientName(clients: Client[], clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
}

/** Describes a whole-day offset from today: "due today", "due in N days" or "was due N days ago". */
function dueDescription(days: number): string {
  if (days === 0) return "due today";
  if (days > 0) return `due in ${days} ${days === 1 ? "day" : "days"}`;
  const late = -days;
  return `was due ${late} ${late === 1 ? "day" : "days"} ago`;
}

function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/**
 * Computes prioritized, actionable alerts from the ledger and the baseline cash forecast.
 * Pure: inputs are never mutated and the clock is never read; `today` is supplied by the caller.
 */
export function buildAlerts(inputs: AlertInputs): Alert[] {
  const { today, invoices, bills, clients, cashAccounts } = inputs;
  const currentCash = cashAccounts.reduce((total, account) => total + account.balanceINR, 0);
  const baseline = calculateCashForecast(currentCash, invoices, bills, FORECAST_HORIZON_DAYS, today);

  // An invoice may be described as needed for cash-positive only when the baseline is positive
  // and removing that invoice would make the forecast go negative.
  const claimsCashPositive = (invoice: Invoice): boolean =>
    baseline.firstNegativeDate === null &&
    calculateCashForecast(
      currentCash,
      invoices.filter((other) => other.id !== invoice.id),
      bills,
      FORECAST_HORIZON_DAYS,
      today,
    ).firstNegativeDate !== null;

  const alerts: Alert[] = [];

  for (const invoice of invoices) {
    if (invoice.status === "overdue") {
      const name = clientName(clients, invoice.clientId);
      const late = invoice.dueDate < today ? daysBetween(invoice.dueDate, today) : 0;
      const lateText = late > 0 ? `${late} ${late === 1 ? "day" : "days"} overdue` : "due today";
      const clause = claimsCashPositive(invoice) ? " Its amount is needed to stay cash-positive." : "";
      alerts.push({
        id: `invoice-overdue-${invoice.id}`,
        priority: "high",
        title: "Overdue invoice",
        message: `${name} owes ${formatINR(invoice.amountINR)} on invoice ${invoice.id}, ${lateText}.${clause}`,
        actionLabel: INVOICE_ACTION_LABEL,
        action: { kind: "invoice", invoiceId: invoice.id },
        date: invoice.dueDate,
      });
    } else if (
      invoice.status === "sent" &&
      invoice.dueDate >= today &&
      invoice.dueDate <= addDays(today, INVOICE_DUE_MEDIUM_DAYS)
    ) {
      const name = clientName(clients, invoice.clientId);
      const days = daysBetween(today, invoice.dueDate);
      const clause = claimsCashPositive(invoice) ? " Its amount is needed to stay cash-positive." : "";
      alerts.push({
        id: `invoice-due-${invoice.id}`,
        priority: "medium",
        title: "Invoice due soon",
        message: `${name} owes ${formatINR(invoice.amountINR)} on invoice ${invoice.id}, ${dueDescription(days)}.${clause}`,
        actionLabel: INVOICE_ACTION_LABEL,
        action: { kind: "invoice", invoiceId: invoice.id },
        date: invoice.dueDate,
      });
    }
  }

  for (const bill of bills) {
    if (bill.status === "paid") continue;
    const days = daysBetween(today, bill.dueDate);
    const message = `${bill.name} of ${formatINR(bill.amountINR)} is ${dueDescription(days)}.`;

    if (bill.status === "overdue") {
      alerts.push({
        id: `bill-${bill.id}`,
        priority: "high",
        title: bill.name,
        message,
        actionLabel: FORECAST_ACTION_LABEL,
        action: { kind: "forecast" },
        date: bill.dueDate,
      });
    } else if (bill.status === "upcoming") {
      let priority: AlertPriority | null = null;
      if (bill.dueDate >= today && bill.dueDate <= addDays(today, BILL_HIGH_DAYS)) {
        priority = "high";
      } else if (bill.dueDate > addDays(today, BILL_HIGH_DAYS) && bill.dueDate <= addDays(today, BILL_MEDIUM_DAYS)) {
        priority = "medium";
      }
      if (priority !== null) {
        alerts.push({
          id: `bill-${bill.id}`,
          priority,
          title: bill.name,
          message,
          actionLabel: FORECAST_ACTION_LABEL,
          action: { kind: "forecast" },
          date: bill.dueDate,
        });
      }
    }
  }

  if (baseline.firstNegativeDate !== null) {
    const shortfall = firstShortfall(baseline);
    if (shortfall !== null) {
      alerts.push({
        id: "forecast-negative",
        priority: "critical",
        title: "Cash goes negative",
        message: `Projected cash falls below zero on ${formatDate(shortfall.date)}, a shortfall of \u2212${formatINR(shortfall.shortfallINR)}.`,
        actionLabel: FORECAST_ACTION_LABEL,
        action: { kind: "forecast" },
        date: baseline.firstNegativeDate,
      });
    }
  }

  return alerts.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      compareDates(a.date, b.date) ||
      a.id.localeCompare(b.id),
  );
}
