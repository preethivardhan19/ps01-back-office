import { describe, expect, it } from "vitest";
import type { Bill } from "../types";
import { calculateCashForecast } from "./cashForecast";

const START = "2025-02-01";
const HORIZON = 90; // window 2025-02-01 .. 2025-05-01

function billEventDates(bills: Bill[]): string[] {
  return calculateCashForecast(0, [], bills, HORIZON, START)
    .events.filter((event) => event.type === "bill")
    .map((event) => event.date);
}

describe("cash forecast: recurring bill anchored to original date", () => {
  it("does not re-count a paid occurrence after dueDate advances, and uses month-end anchor rule", () => {
    const bill: Bill = {
      id: "b-anchor",
      name: "Rent",
      category: "Housing",
      amountINR: 1000,
      dueDate: "2025-03-31", // already advanced one step past the paid Feb occurrence
      status: "upcoming",
      recurrence: "monthly",
      anchorDate: "2025-01-31",
    };

    const dates = billEventDates([bill]);

    expect(dates).not.toContain("2025-02-28");
    expect(dates).toEqual(["2025-03-31", "2025-04-30"]);
  });
});

describe("cash forecast: bill without anchorDate", () => {
  it("uses dueDate as the anchor, exactly as before", () => {
    const bill: Bill = {
      id: "b-legacy",
      name: "Internet",
      category: "Utilities",
      amountINR: 500,
      dueDate: "2025-01-31",
      status: "upcoming",
      recurrence: "monthly",
    };

    expect(billEventDates([bill])).toEqual(["2025-02-28", "2025-03-31", "2025-04-30"]);
  });

  it("produces the same dates as an explicit anchorDate equal to dueDate", () => {
    const base: Bill = {
      id: "b-same",
      name: "Internet",
      category: "Utilities",
      amountINR: 500,
      dueDate: "2025-01-31",
      status: "upcoming",
      recurrence: "monthly",
    };

    expect(billEventDates([{ ...base, anchorDate: "2025-01-31" }])).toEqual(billEventDates([base]));
  });
});

describe("cash forecast: one-time paid bill", () => {
  it("is excluded from the forecast", () => {
    const bill: Bill = {
      id: "b-paid",
      name: "Repair",
      category: "Maintenance",
      amountINR: 2000,
      dueDate: "2025-02-10",
      status: "paid",
      recurrence: "one-time",
    };

    expect(billEventDates([bill])).toEqual([]);
  });
});
