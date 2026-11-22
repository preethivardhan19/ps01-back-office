import type { Client, FollowUp, Invoice } from "../types";
import { addDays } from "./format";

export interface ClientBalance {
  client: Client;
  outstandingINR: number;
  invoiceCount: number;
}

const REMINDER_WINDOW_DAYS = 14;

/** True for every status except "paid" (draft, sent, overdue). */
export function isUnpaid(invoice: Invoice): boolean {
  return invoice.status !== "paid";
}

/**
 * One row per client, summing only unpaid invoices.
 * Sorted by outstanding amount (descending), then client name (ascending).
 */
export function outstandingByClient(clients: readonly Client[], invoices: readonly Invoice[]): ClientBalance[] {
  const unpaid = invoices.filter(isUnpaid);

  return clients
    .map((client) => {
      const mine = unpaid.filter((invoice) => invoice.clientId === client.id);
      return {
        client,
        outstandingINR: mine.reduce((total, invoice) => total + invoice.amountINR, 0),
        invoiceCount: mine.length,
      };
    })
    .sort(
      (a, b) =>
        b.outstandingINR - a.outstandingINR || a.client.name.localeCompare(b.client.name),
    );
}

/** Follow-ups for one invoice, newest first. */
export function followUpsFor(invoiceId: string, followUps: readonly FollowUp[]): FollowUp[] {
  return followUps
    .filter((followUp) => followUp.invoiceId === invoiceId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * An overdue invoice needs a reminder when it has no follow-up
 * dated on or after (today - 14 days).
 */
export function needsReminder(invoice: Invoice, followUps: readonly FollowUp[], today: string): boolean {
  if (invoice.status !== "overdue") {
    return false;
  }
  const windowStart = addDays(today, -REMINDER_WINDOW_DAYS);
  const hasRecent = followUps.some(
    (followUp) => followUp.invoiceId === invoice.id && followUp.date >= windowStart,
  );
  return !hasRecent;
}
