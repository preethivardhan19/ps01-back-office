import { describe, expect, it } from "vitest";
import { appStateReducer, nextBillId } from "./AppState";
import type { AppState } from "./AppState";
import { bills as seedBills, cashAccounts as seedCashAccounts, invoices as seedInvoices, payments as seedPayments } from "../data/seed";
import type { Bill } from "../types";

function makeState(resetCount = 0): AppState {
  return {
    bills: seedBills.map((b) => ({ ...b })),
    billPayments: [],
    cashAccounts: seedCashAccounts.map((a) => ({ ...a })),
    invoices: seedInvoices.map((i) => ({ ...i })),
    payments: seedPayments.map((p) => ({ ...p })),
    resetCount,
  };
}

function balanceOf(state: AppState, accountId: string): number {
  return state.cashAccounts.find((a) => a.id === accountId)?.balanceINR ?? NaN;
}

describe("appStateReducer", () => {
  it("reset restores seed cashAccounts and bills, clears billPayments, and increments resetCount", () => {
    const upcomingSeed = seedBills.find((b) => b.status === "upcoming");
    expect(upcomingSeed).toBeDefined();

    const start = makeState(2);
    const paid = appStateReducer(start, {
      type: "payBill",
      billId: upcomingSeed!.id,
      accountId: "CA-02",
      paymentId: "BP-test-reset",
    });
    expect(paid.billPayments).toHaveLength(1);
    expect(balanceOf(paid, "CA-02")).not.toBe(balanceOf(start, "CA-02"));

    const reset = appStateReducer(paid, { type: "reset" });
    expect(reset.cashAccounts).toEqual(seedCashAccounts);
    expect(reset.bills).toEqual(seedBills);
    expect(reset.billPayments).toEqual([]);
    expect(reset.resetCount).toBe(paid.resetCount + 1);
  });

  it("paying the same one-time bill twice leaves the state unchanged on the second dispatch", () => {
    const oneTime: Bill = {
      id: "B-07",
      name: "One-off licence",
      category: "Software",
      amountINR: 1000,
      dueDate: seedBills[0].dueDate,
      status: "upcoming",
      recurrence: "one-time",
    };
    const withBill = appStateReducer(makeState(), { type: "addBill", bill: oneTime });

    const first = appStateReducer(withBill, {
      type: "payBill",
      billId: "B-07",
      accountId: "CA-02",
      paymentId: "BP-test-once-1",
    });
    const balanceAfterFirst = balanceOf(first, "CA-02");
    expect(balanceAfterFirst).toBe(balanceOf(withBill, "CA-02") - 1000);

    const second = appStateReducer(first, {
      type: "payBill",
      billId: "B-07",
      accountId: "CA-02",
      paymentId: "BP-test-once-2",
    });
    expect(second).toBe(first);
    expect(balanceOf(second, "CA-02")).toBe(balanceAfterFirst);
    expect(second.billPayments).toHaveLength(1);
  });
});

describe("nextBillId", () => {
  it("returns the id after the highest existing B-NN number", () => {
    const ids = seedBills.map((b) => b.id);
    expect(ids).toEqual(["B-01", "B-02", "B-03", "B-04", "B-05", "B-06"]);
    expect(nextBillId(seedBills)).toBe("B-07");
  });

  it("uses the highest number, not the count, when ids have gaps", () => {
    const sparse = [{ ...seedBills[0], id: "B-02" }, { ...seedBills[1], id: "B-09" }];
    expect(nextBillId(sparse)).toBe("B-10");
  });
});

describe("addBill", () => {
  it("appends the bill and leaves other fields unchanged", () => {
    const start = makeState();
    const bill: Bill = {
      id: "B-07",
      name: "Test bill",
      category: "Utilities",
      amountINR: 500,
      dueDate: "2025-07-01",
      status: "upcoming",
      recurrence: "monthly",
      anchorDate: "2025-07-01",
    };
    const next = appStateReducer(start, { type: "addBill", bill });

    expect(next.bills).toHaveLength(start.bills.length + 1);
    expect(next.bills[next.bills.length - 1]).toEqual(bill);
    expect(next.bills.slice(0, start.bills.length)).toEqual(start.bills);
    expect(next.cashAccounts).toEqual(start.cashAccounts);
    expect(next.billPayments).toEqual(start.billPayments);
    expect(next.invoices).toEqual(start.invoices);
    expect(next.resetCount).toBe(start.resetCount);
  });
});
