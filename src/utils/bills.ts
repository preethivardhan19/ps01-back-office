// Pure bill helpers for the Bills screen. No React, no side effects, no mutation of inputs.
// All dates are ISO calendar dates "YYYY-MM-DD"; arithmetic is UTC-based to avoid timezone drift.

import type { Bill, BillPayment, CashAccount, Recurrence } from "../types";

export type BillFormField = "name" | "category" | "amount" | "dueDate";

export interface BillFormInput {
  name: string;
  category: string;
  amount: string;
  dueDate: string;
  recurring: boolean;
}

export interface BillValue {
  name: string;
  category: string;
  amountINR: number;
  dueDate: string;
  recurrence: Recurrence;
}

export interface BillState {
  bills: Bill[];
  billPayments: BillPayment[];
  cashAccounts: CashAccount[];
}

export interface PayBillArgs {
  billId: string;
  accountId: string;
  paidDate: string;
  paymentId: string;
}

export type PayBillResult =
  | { ok: true; state: BillState }
  | { ok: false; error: string };

const STEP_MONTHS: Record<Exclude<Recurrence, "one-time">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Plain decimal amounts only: digits with an optional one or two decimal places.
// Rejects hex, scientific notation, signs, separators and bare "." edges (".5", "500.").
const PLAIN_AMOUNT = /^\d+(\.\d{1,2})?$/;

function parseIso(date: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1) return null;
  if (d > daysInMonth(y, m - 1)) return null;
  return { y, m, d };
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatIso(y: number, m0: number, d: number): string {
  return `${pad(y, 4)}-${pad(m0 + 1, 2)}-${pad(d, 2)}`;
}

/** Occurrence k steps after the anchor, clamping the day to the target month's length. */
function occurrenceAt(anchor: { y: number; m: number; d: number }, stepMonths: number, k: number): string {
  const total = anchor.y * 12 + (anchor.m - 1) + k * stepMonths;
  const ty = Math.floor(total / 12);
  const tm0 = total % 12;
  const day = Math.min(anchor.d, daysInMonth(ty, tm0));
  return formatIso(ty, tm0, day);
}

/**
 * Next occurrence strictly after currentDue, computed from the ORIGINAL anchor
 * so that month-end anchors (e.g. the 31st) do not drift permanently to the 28th/30th.
 * One-time bills return currentDue unchanged (the caller marks them paid instead).
 */
export function nextDueDate(anchorDate: string, recurrence: Recurrence, currentDue: string): string {
  if (recurrence === "one-time") return currentDue;
  const anchor = parseIso(anchorDate);
  if (!anchor) return currentDue;
  // Guard: corrupted currentDue would make the comparison loop below never terminate.
  const cur = parseIso(currentDue);
  if (!cur) return currentDue;
  const stepMonths = STEP_MONTHS[recurrence];

  const monthsDiff = (cur.y - anchor.y) * 12 + (cur.m - anchor.m);
  let k = Math.max(0, Math.floor(monthsDiff / stepMonths) - 1);
  let candidate = occurrenceAt(anchor, stepMonths, k);
  while (candidate <= currentDue) {
    k += 1;
    candidate = occurrenceAt(anchor, stepMonths, k);
  }
  return candidate;
}

export function validateBillInput(input: BillFormInput): {
  errors: Partial<Record<BillFormField, string>>;
  value: BillValue | null;
} {
  const errors: Partial<Record<BillFormField, string>> = {};

  const name = input.name.trim();
  if (name === "") errors.name = "Title is required.";

  const category = input.category.trim();
  if (category === "") errors.category = "Category is required.";

  const amountText = input.amount.trim();
  const amountNum = PLAIN_AMOUNT.test(amountText) ? Number(amountText) : NaN;
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = "Enter a positive amount in INR";
  }

  const dueDate = input.dueDate.trim();
  if (dueDate === "") {
    errors.dueDate = "Due date is required.";
  } else if (!parseIso(dueDate)) {
    errors.dueDate = "Due date must be a valid YYYY-MM-DD date.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, value: null };
  }

  return {
    errors,
    value: {
      name,
      category,
      amountINR: amountNum,
      dueDate,
      recurrence: input.recurring ? "monthly" : "one-time",
    },
  };
}

export function createBill(value: BillValue, id: string): Bill {
  return {
    id,
    name: value.name,
    category: value.category,
    amountINR: value.amountINR,
    dueDate: value.dueDate,
    status: "upcoming",
    recurrence: value.recurrence,
    anchorDate: value.dueDate,
  };
}

/**
 * Settles exactly ONE occurrence of a bill and debits the chosen account exactly once.
 * Returns new arrays/objects; the input state is never mutated.
 */
export function payBill(state: BillState, args: PayBillArgs): PayBillResult {
  const { billId, accountId, paidDate, paymentId } = args;

  const bill = state.bills.find((b) => b.id === billId);
  if (!bill) return { ok: false, error: "Bill not found." };
  if (bill.status === "paid") return { ok: false, error: "Bill is already paid." };

  const account = state.cashAccounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Payment account not found." };

  if (!(bill.amountINR > 0)) return { ok: false, error: "Bill amount must be greater than 0." };

  const occurrenceDueDate = bill.dueDate;

  let updatedBill: Bill;
  if (bill.recurrence === "one-time") {
    updatedBill = { ...bill, status: "paid" };
  } else {
    const newDue = nextDueDate(bill.anchorDate ?? bill.dueDate, bill.recurrence, bill.dueDate);
    updatedBill = {
      ...bill,
      dueDate: newDue,
      status: newDue >= paidDate ? "upcoming" : "overdue",
    };
  }

  const payment: BillPayment = {
    id: paymentId,
    billId,
    accountId,
    amountINR: bill.amountINR,
    paidDate,
    occurrenceDueDate,
  };

  return {
    ok: true,
    state: {
      bills: state.bills.map((b) => (b.id === billId ? updatedBill : { ...b })),
      billPayments: [...state.billPayments.map((p) => ({ ...p })), payment],
      cashAccounts: state.cashAccounts.map((a) =>
        a.id === accountId
          ? { ...a, balanceINR: a.balanceINR - bill.amountINR, asOfDate: paidDate }
          : { ...a },
      ),
    },
  };
}
