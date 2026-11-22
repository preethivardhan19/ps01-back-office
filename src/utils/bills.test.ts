import { describe, expect, it } from "vitest";
import type { Bill, BillPayment, CashAccount } from "../types";
import {
  createBill,
  nextDueDate,
  payBill,
  validateBillInput,
  type BillFormInput,
  type BillState,
} from "./bills";

function makeInput(overrides: Partial<BillFormInput> = {}): BillFormInput {
  return {
    name: "Electricity",
    category: "Utilities",
    amount: "1500",
    dueDate: "2025-07-01",
    recurring: false,
    ...overrides,
  };
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "B-1",
    name: "Internet",
    category: "Utilities",
    amountINR: 999,
    dueDate: "2025-06-01",
    status: "upcoming",
    recurrence: "one-time",
    ...overrides,
  };
}

function makeAccounts(): CashAccount[] {
  return [
    { id: "CA-01", label: "Savings", balanceINR: 10000, asOfDate: "2025-06-01" },
    { id: "CA-02", label: "Current", balanceINR: 50000, asOfDate: "2025-06-01" },
    { id: "CA-03", label: "Petty cash", balanceINR: 2000, asOfDate: "2025-06-01" },
  ];
}

function makeState(bills: Bill[], billPayments: BillPayment[] = []): BillState {
  return { bills, billPayments, cashAccounts: makeAccounts() };
}

describe("validateBillInput", () => {
  it("flags an empty title on name", () => {
    const { errors, value } = validateBillInput(makeInput({ name: "   " }));
    expect(errors.name).toBeDefined();
    expect(value).toBeNull();
  });

  it("flags a blank category", () => {
    const { errors, value } = validateBillInput(makeInput({ category: "  " }));
    expect(errors.category).toBeDefined();
    expect(value).toBeNull();
  });

  it.each(["0", "-5", "abc", ""])("flags amount %j as invalid", (amount) => {
    const { errors, value } = validateBillInput(makeInput({ amount }));
    expect(errors.amount).toBeDefined();
    expect(value).toBeNull();
  });

  it("accepts a valid one-time bill", () => {
    const { errors, value } = validateBillInput(makeInput());
    expect(errors).toEqual({});
    expect(value).not.toBeNull();
    expect(typeof value?.amountINR).toBe("number");
    expect(value?.amountINR).toBe(1500);
    expect(value?.recurrence).toBe("one-time");
  });

  it("maps recurring to monthly", () => {
    const { value } = validateBillInput(makeInput({ recurring: true }));
    expect(value?.recurrence).toBe("monthly");
  });

  it("rejects an invalid date string", () => {
    const { errors, value } = validateBillInput(makeInput({ dueDate: "2025-02-30" }));
    expect(errors.dueDate).toBeDefined();
    expect(value).toBeNull();
  });
});

describe("nextDueDate", () => {
  it("steps monthly from the anchor with month-end clamping that recovers", () => {
    const first = nextDueDate("2025-01-31", "monthly", "2025-01-31");
    expect(first).toBe("2025-02-28");
    const second = nextDueDate("2025-01-31", "monthly", first);
    expect(second).toBe("2025-03-31");
    const third = nextDueDate("2025-01-31", "monthly", second);
    expect(third).toBe("2025-04-30");
  });

  it("handles quarterly and yearly steps", () => {
    expect(nextDueDate("2025-01-15", "quarterly", "2025-01-15")).toBe("2025-04-15");
    expect(nextDueDate("2025-03-10", "yearly", "2025-03-10")).toBe("2026-03-10");
  });

  it("returns currentDue unchanged for one-time bills", () => {
    expect(nextDueDate("2025-06-01", "one-time", "2025-06-01")).toBe("2025-06-01");
  });

  it("uses leap-year February for a 31st anchor", () => {
    expect(nextDueDate("2024-01-31", "monthly", "2024-01-31")).toBe("2024-02-29");
  });
});

describe("createBill", () => {
  it("sets anchorDate to dueDate and status to upcoming", () => {
    const { value } = validateBillInput(makeInput({ dueDate: "2025-08-20", recurring: true }));
    expect(value).not.toBeNull();
    const bill = createBill(value!, "B-9");
    expect(bill.id).toBe("B-9");
    expect(bill.anchorDate).toBe("2025-08-20");
    expect(bill.dueDate).toBe("2025-08-20");
    expect(bill.status).toBe("upcoming");
  });
});

describe("payBill", () => {
  it("settles a one-time bill, debits the chosen account once, and appends one payment", () => {
    const bill = makeBill({ amountINR: 999 });
    const state = makeState([bill]);
    const snapshot = JSON.parse(JSON.stringify(state));

    const result = payBill(state, {
      billId: "B-1",
      accountId: "CA-01",
      paidDate: "2025-06-15",
      paymentId: "P-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    expect(next.bills[0].status).toBe("paid");
    expect(next.billPayments).toHaveLength(1);
    expect(next.billPayments[0]).toEqual({
      id: "P-1",
      billId: "B-1",
      accountId: "CA-01",
      amountINR: 999,
      paidDate: "2025-06-15",
      occurrenceDueDate: "2025-06-01",
    });

    const ca01 = next.cashAccounts.find((a) => a.id === "CA-01");
    expect(ca01?.balanceINR).toBe(10000 - 999);
    expect(ca01?.asOfDate).toBe("2025-06-15");
    expect(next.cashAccounts.find((a) => a.id === "CA-02")).toEqual(makeAccounts()[1]);
    expect(next.cashAccounts.find((a) => a.id === "CA-03")).toEqual(makeAccounts()[2]);

    // inputs untouched
    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });

  it("debits CA-02 exactly once when CA-02 is the chosen account", () => {
    const state = makeState([makeBill({ amountINR: 400 })]);
    const result = payBill(state, {
      billId: "B-1",
      accountId: "CA-02",
      paidDate: "2025-06-15",
      paymentId: "P-2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cashAccounts.find((a) => a.id === "CA-02")?.balanceINR).toBe(50000 - 400);
  });

  it("rejects a second payment on a one-time bill without debiting again", () => {
    const state = makeState([makeBill({ amountINR: 300 })]);
    const first = payBill(state, {
      billId: "B-1",
      accountId: "CA-02",
      paidDate: "2025-06-15",
      paymentId: "P-1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = payBill(first.state, {
      billId: "B-1",
      accountId: "CA-02",
      paidDate: "2025-06-16",
      paymentId: "P-2",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(first.state.cashAccounts.find((a) => a.id === "CA-02")?.balanceINR).toBe(50000 - 300);
    expect(first.state.billPayments).toHaveLength(1);
  });

  it("settles only one occurrence of an overdue recurring bill", () => {
    const bill = makeBill({
      dueDate: "2025-03-31",
      anchorDate: "2025-01-31",
      recurrence: "monthly",
      status: "overdue",
      amountINR: 500,
    });
    const state = makeState([bill]);

    const result = payBill(state, {
      billId: "B-1",
      accountId: "CA-02",
      paidDate: "2025-06-15",
      paymentId: "P-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // One step from the anchor after 2025-03-31 is 2025-04-30 (not stepped from currentDue).
    expect(result.state.bills[0].dueDate).toBe("2025-04-30");
    // Still before paidDate, so overdue.
    expect(result.state.bills[0].status).toBe("overdue");
    expect(result.state.billPayments).toHaveLength(1);
    expect(result.state.billPayments[0].occurrenceDueDate).toBe("2025-03-31");
    expect(result.state.cashAccounts.find((a) => a.id === "CA-02")?.balanceINR).toBe(50000 - 500);
    // Input bill unchanged.
    expect(state.bills[0].dueDate).toBe("2025-03-31");
  });

  it("returns ok:false and unchanged state for unknown bill or account", () => {
    const state = makeState([makeBill()]);
    const snapshot = JSON.parse(JSON.stringify(state));

    const unknownBill = payBill(state, {
      billId: "nope",
      accountId: "CA-01",
      paidDate: "2025-06-15",
      paymentId: "P-1",
    });
    expect(unknownBill.ok).toBe(false);

    const unknownAccount = payBill(state, {
      billId: "B-1",
      accountId: "CA-99",
      paidDate: "2025-06-15",
      paymentId: "P-1",
    });
    expect(unknownAccount.ok).toBe(false);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });
});

describe("amount validation", () => {
  const base = (amount: string) =>
    validateBillInput({
      name: "Electricity",
      category: "Utilities",
      amount,
      dueDate: "2025-07-01",
      recurring: false,
    });

  it.each([
    ["500", 500],
    ["500.50", 500.5],
    ["28000", 28000],
    ["0.01", 0.01],
    ["1", 1],
  ])("accepts amount %j as %d", (amount, expected) => {
    const { errors, value } = base(amount);
    expect(errors.amount).toBeUndefined();
    expect(value?.amountINR).toBe(expected);
  });

  it.each(["", "   ", "0", "0.00", "-5", "0x10", "1e3", "1E3", "+5", "1.234", "1.2.3", "12a", "abc", ".5", "500.", "1,000"])(
    "rejects amount %j",
    (amount) => {
      const { errors, value } = base(amount);
      expect(typeof errors.amount).toBe("string");
      expect(errors.amount).not.toBe("");
      expect(value).toBeNull();
    },
  );
});

