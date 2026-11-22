import { describe, expect, it } from "vitest";
import type { Bill, Invoice, InvoiceStatus, Recurrence } from "../types";
import { addDays } from "./format";
import { calculateCashForecast } from "./cashForecast";
import {
  applyDelays,
  badDaySelection,
  eligibleWhatIfInvoices,
  firstShortfall,
  simulateForecast,
} from "./whatIfForecast";

const START = "2025-06-15";

function makeInvoice(overrides: Partial<Invoice> & { id: string; status: InvoiceStatus }): Invoice {
  return {
    clientId: "C-01",
    description: `Invoice ${overrides.id}`,
    amountINR: 10000,
    issueDate: "2025-06-01",
    dueDate: addDays(START, 5),
    ...overrides,
  };
}

function makeBill(
  overrides: Partial<Bill> & { id: string; recurrence: Recurrence; dueDate: string },
): Bill {
  return {
    name: `Bill ${overrides.id}`,
    category: "Test",
    amountINR: 1000,
    status: "upcoming",
    ...overrides,
  };
}

describe("simulateForecast", () => {
  it("matches calculateCashForecast when no delays are applied", () => {
    const invoices = [
      makeInvoice({ id: "INV-O", status: "overdue", amountINR: 50000, dueDate: addDays(START, -10) }),
      makeInvoice({ id: "INV-S", status: "sent", amountINR: 20000, dueDate: addDays(START, 7) }),
    ];
    const bills = [makeBill({ id: "B-RENT", recurrence: "monthly", dueDate: addDays(START, 4) })];

    const simulated = simulateForecast(10000, invoices, bills, 60, {}, START);
    const baseline = calculateCashForecast(10000, invoices, bills, 60, START);

    expect(simulated).toEqual(baseline);
  });

  it("moves an overdue invoice's inflow from day 0 to day 15 when delayed by 15 days", () => {
    const overdue = makeInvoice({ id: "INV-O", status: "overdue", amountINR: 50000, dueDate: addDays(START, -10) });
    const forecast = simulateForecast(0, [overdue], [], 30, { "INV-O": 15 }, START);

    const inflowIndexes = forecast.days
      .map((day, index) => (day.inflowINR > 0 ? index : -1))
      .filter((index) => index >= 0);

    expect(inflowIndexes).toEqual([15]);
    expect(forecast.days[0].inflowINR).toBe(0);
    expect(forecast.days[15].inflowINR).toBe(50000);
    expect(forecast.days[15].date).toBe(addDays(START, 15));
  });

  it("moves a sent invoice due in 3 days to day 18 when delayed by 15 days", () => {
    const sent = makeInvoice({ id: "INV-S", status: "sent", amountINR: 20000, dueDate: addDays(START, 3) });
    const forecast = simulateForecast(0, [sent], [], 30, { "INV-S": 15 }, START);

    const inflowIndexes = forecast.days
      .map((day, index) => (day.inflowINR > 0 ? index : -1))
      .filter((index) => index >= 0);

    expect(inflowIndexes).toEqual([18]);
    expect(forecast.days[18].inflowINR).toBe(20000);
  });

  it("removes an inflow from total inflows when the delay pushes it beyond the horizon", () => {
    const sent = makeInvoice({ id: "INV-L", status: "sent", amountINR: 20000, dueDate: addDays(START, 5) });
    const forecast = simulateForecast(0, [sent], [], 30, { "INV-L": 40 }, START);

    const totalInflow = forecast.days.reduce((total, day) => total + day.inflowINR, 0);

    expect(totalInflow).toBe(0);
    expect(forecast.events.some((event) => event.sourceId === "INV-L")).toBe(false);
  });
});

describe("badDaySelection", () => {
  it("selects 5 clients with the earliest placement, breaking equal placement by invoice id", () => {
    // C-01..C-04 have distinct earlier due dates. C-05 (INV-B) and C-06 (INV-A) tie on due date,
    // so the invoice id decides: INV-A wins the fifth slot.
    const invoices = [
      makeInvoice({ id: "INV-1", status: "sent", clientId: "C-01", dueDate: addDays(START, 1) }),
      makeInvoice({ id: "INV-2", status: "sent", clientId: "C-02", dueDate: addDays(START, 2) }),
      makeInvoice({ id: "INV-3", status: "sent", clientId: "C-03", dueDate: addDays(START, 3) }),
      makeInvoice({ id: "INV-4", status: "sent", clientId: "C-04", dueDate: addDays(START, 4) }),
      makeInvoice({ id: "INV-B", status: "sent", clientId: "C-05", dueDate: addDays(START, 5) }),
      makeInvoice({ id: "INV-A", status: "sent", clientId: "C-06", dueDate: addDays(START, 5) }),
    ];

    const selection = badDaySelection(invoices, START);

    expect(selection.clientIds).toHaveLength(5);
    expect([...selection.clientIds].sort()).toEqual(["C-01", "C-02", "C-03", "C-04", "C-06"]);
    expect(selection.availableClientCount).toBe(6);
  });

  it("returns all 3 eligible clients when there are only 3", () => {
    const invoices = [
      makeInvoice({ id: "INV-1", status: "sent", clientId: "C-01", dueDate: addDays(START, 1) }),
      makeInvoice({ id: "INV-2", status: "overdue", clientId: "C-02", dueDate: addDays(START, -2) }),
      makeInvoice({ id: "INV-3", status: "sent", clientId: "C-03", dueDate: addDays(START, 6) }),
    ];

    const selection = badDaySelection(invoices, START);

    expect(selection.clientIds).toHaveLength(3);
    expect(selection.availableClientCount).toBe(3);
  });

  it("returns an empty selection when no invoices are eligible", () => {
    const invoices = [makeInvoice({ id: "INV-P", status: "paid", paidDate: START })];

    const selection = badDaySelection(invoices, START);

    expect(selection.clientIds).toEqual([]);
    expect(selection.availableClientCount).toBe(0);
    expect(selection.invoiceIds).toEqual([]);
  });

  it("never includes draft or paid invoices in eligibility or selected invoice ids", () => {
    const invoices = [
      makeInvoice({ id: "INV-D", status: "draft", clientId: "C-01", dueDate: addDays(START, -3) }),
      makeInvoice({ id: "INV-P", status: "paid", clientId: "C-02", paidDate: START }),
      makeInvoice({ id: "INV-S", status: "sent", clientId: "C-03", dueDate: addDays(START, 2) }),
    ];

    const eligibleIds = eligibleWhatIfInvoices(invoices).map((invoice) => invoice.id);
    const selection = badDaySelection(invoices, START);

    expect(eligibleIds).not.toContain("INV-D");
    expect(eligibleIds).not.toContain("INV-P");
    expect(selection.invoiceIds).not.toContain("INV-D");
    expect(selection.invoiceIds).not.toContain("INV-P");
  });
});

describe("firstShortfall", () => {
  it("returns the first negative day and a positive shortfall", () => {
    const bill = makeBill({ id: "B-BIG", recurrence: "one-time", dueDate: "2025-06-18", amountINR: 5000 });
    const forecast = calculateCashForecast(1000, [], [bill], 30, START);

    const shortfall = firstShortfall(forecast);

    expect(shortfall).not.toBeNull();
    expect(shortfall?.date).toBe("2025-06-18");
    expect(shortfall?.shortfallINR).toBeGreaterThan(0);
  });

  it("returns null when the balance never goes negative", () => {
    const bill = makeBill({ id: "B-OK", recurrence: "one-time", dueDate: "2025-06-18", amountINR: 500 });
    const forecast = calculateCashForecast(1000, [], [bill], 30, START);

    expect(firstShortfall(forecast)).toBeNull();
  });
});

describe("applyDelays", () => {
  it("does not mutate the input invoices or their objects", () => {
    const invoices = [
      makeInvoice({ id: "INV-O", status: "overdue", dueDate: addDays(START, -10) }),
      makeInvoice({ id: "INV-S", status: "sent", dueDate: addDays(START, 3) }),
    ];
    const snapshot = structuredClone(invoices);

    applyDelays(invoices, { "INV-O": 15, "INV-S": 15 }, START);

    expect(invoices).toHaveLength(snapshot.length);
    expect(invoices).toEqual(snapshot);
  });
});
