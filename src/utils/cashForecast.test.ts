import { describe, expect, it } from "vitest";
import { TODAY, bills as seedBills, cashAccounts, invoices as seedInvoices } from "../data/seed";
import type { Bill, Invoice, InvoiceStatus, Recurrence } from "../types";
import { addDays } from "./format";
import { type HorizonDays, calculateCashForecast } from "./cashForecast";

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

describe("calculateCashForecast", () => {
  it("throws a RangeError for a horizon other than 30, 60 or 90", () => {
    expect(() => calculateCashForecast(0, [], [], 45 as HorizonDays)).toThrow(RangeError);
  });

  it.each([30, 60, 90] as HorizonDays[])("produces %i daily rows from startDate", (horizon) => {
    const forecast = calculateCashForecast(0, [], [], horizon, START);

    expect(forecast.horizonDays).toBe(horizon);
    expect(forecast.startDate).toBe(START);
    expect(forecast.days).toHaveLength(horizon);
    expect(forecast.days[0].date).toBe(START);
    expect(forecast.days[horizon - 1].date).toBe(addDays(START, horizon - 1));
  });

  it("excludes paid invoices", () => {
    const paid = makeInvoice({ id: "INV-P", status: "paid", paidDate: START });
    const forecast = calculateCashForecast(0, [paid], [], 30, START);

    expect(forecast.events).toHaveLength(0);
    expect(forecast.days.every((day) => day.inflowINR === 0)).toBe(true);
  });

  it("excludes draft invoices", () => {
    const draft = makeInvoice({ id: "INV-D", status: "draft" });
    const forecast = calculateCashForecast(0, [draft], [], 30, START);

    expect(forecast.events).toHaveLength(0);
    expect(forecast.days.every((day) => day.inflowINR === 0)).toBe(true);
  });

  it("counts an overdue invoice as an inflow on startDate", () => {
    const overdue = makeInvoice({
      id: "INV-O",
      status: "overdue",
      amountINR: 50000,
      dueDate: addDays(START, -10),
    });
    const forecast = calculateCashForecast(0, [overdue], [], 30, START);

    expect(forecast.days[0].inflowINR).toBe(50000);
    expect(forecast.days[0].balanceINR).toBe(50000);
    expect(forecast.events[0]).toMatchObject({
      date: START,
      type: "invoice",
      direction: "in",
      amountINR: 50000,
      sourceId: "INV-O",
    });
  });

  it("excludes an invoice whose due date falls after the horizon end", () => {
    const late = makeInvoice({ id: "INV-L", status: "sent", dueDate: addDays(START, 30) });
    const forecast = calculateCashForecast(0, [late], [], 30, START);

    expect(forecast.events).toHaveLength(0);
  });

  it("repeats a monthly bill within a 60-day horizon", () => {
    const rent = makeBill({ id: "B-RENT", recurrence: "monthly", dueDate: "2025-06-20" });
    const forecast = calculateCashForecast(0, [], [rent], 60, START);
    const billDates = forecast.events.filter((event) => event.type === "bill").map((event) => event.date);

    expect(billDates).toEqual(["2025-06-20", "2025-07-20"]);
    expect(forecast.days.reduce((total, day) => total + day.outflowINR, 0)).toBe(2000);
  });

  it("places a yearly bill once within a 90-day horizon", () => {
    const insurance = makeBill({ id: "B-INS", recurrence: "yearly", dueDate: "2025-07-01" });
    const forecast = calculateCashForecast(0, [], [insurance], 90, START);
    const billEvents = forecast.events.filter((event) => event.type === "bill");

    expect(billEvents).toHaveLength(1);
    expect(billEvents[0].date).toBe("2025-07-01");
  });

  it("excludes paid bills", () => {
    const paid = makeBill({ id: "B-PAID", recurrence: "one-time", dueDate: START, status: "paid" });
    const forecast = calculateCashForecast(0, [], [paid], 30, START);

    expect(forecast.events).toHaveLength(0);
    expect(forecast.days.every((day) => day.outflowINR === 0)).toBe(true);
  });

  it("aggregates same-date events and orders the inflow before the outflow", () => {
    // The bill sorts first alphabetically, so only the inflow-first rule puts the invoice ahead of it.
    const invoice = makeInvoice({
      id: "INV-Z",
      status: "sent",
      description: "Zed project",
      amountINR: 10000,
      dueDate: "2025-06-20",
    });
    const bill = makeBill({
      id: "B-A",
      name: "Aardvark rent",
      recurrence: "one-time",
      dueDate: "2025-06-20",
      amountINR: 4000,
    });
    const forecast = calculateCashForecast(100000, [invoice], [bill], 30, START);
    const day = forecast.days.find((row) => row.date === "2025-06-20");

    expect(day).toBeDefined();
    expect(day?.inflowINR).toBe(10000);
    expect(day?.outflowINR).toBe(4000);
    expect(day?.balanceINR).toBe(106000);
    expect(day?.events.map((event) => event.direction)).toEqual(["in", "out"]);
    expect(forecast.events.map((event) => event.sourceId)).toEqual(["INV-Z", "B-A"]);
  });

  it("sets firstNegativeDate and lowestBalanceINR when the balance goes negative", () => {
    const bill = makeBill({ id: "B-BIG", recurrence: "one-time", dueDate: "2025-06-18", amountINR: 5000 });
    const forecast = calculateCashForecast(1000, [], [bill], 30, START);

    expect(forecast.firstNegativeDate).toBe("2025-06-18");
    expect(forecast.lowestBalanceINR).toBe(-4000);
    expect(forecast.days.find((day) => day.date === "2025-06-17")?.balanceINR).toBe(1000);
    expect(forecast.days.find((day) => day.date === "2025-06-18")?.balanceINR).toBe(-4000);
  });

  it("reports firstNegativeDate as null when the balance never goes negative", () => {
    const bill = makeBill({ id: "B-OK", recurrence: "one-time", dueDate: "2025-06-18", amountINR: 500 });
    const forecast = calculateCashForecast(1000, [], [bill], 30, START);

    expect(forecast.firstNegativeDate).toBeNull();
    expect(forecast.lowestBalanceINR).toBe(500);
  });

  it("computes balances from the inputs: changing currentCash shifts every balance equally", () => {
    const invoice = makeInvoice({ id: "INV-S", status: "sent", dueDate: "2025-06-25" });
    const bill = makeBill({ id: "B-S", recurrence: "monthly", dueDate: "2025-06-22" });

    const low = calculateCashForecast(100000, [invoice], [bill], 60, START);
    const high = calculateCashForecast(150000, [invoice], [bill], 60, START);

    expect(high.days).toHaveLength(low.days.length);
    low.days.forEach((day, index) => {
      expect(high.days[index].balanceINR - day.balanceINR).toBe(50000);
    });
    expect(high.lowestBalanceINR - low.lowestBalanceINR).toBe(50000);
  });

  it("matches the seed data: 30 rows and day-0 balance equals opening plus day-0 net", () => {
    const currentCash = cashAccounts.reduce((total, account) => total + account.balanceINR, 0);
    const forecast = calculateCashForecast(currentCash, seedInvoices, seedBills, 30);
    const day0 = forecast.days[0];

    expect(forecast.days).toHaveLength(30);
    expect(day0.date).toBe(TODAY);
    expect(day0.balanceINR).toBe(currentCash + day0.inflowINR - day0.outflowINR);
  });
});
