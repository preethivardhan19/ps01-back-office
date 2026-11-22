import { useState } from "react";
import type { FormEvent } from "react";
import { nextBillId, useAppState } from "../state/AppState";
import type { Bill, BillStatus, Recurrence } from "../types";
import { createBill, validateBillInput } from "../utils/bills";
import type { BillFormField } from "../utils/bills";
import { formatDate, formatINR } from "../utils/format";

const DEFAULT_ACCOUNT_ID = "CA-02";

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const STATUS_STYLES: Record<BillStatus, string> = {
  upcoming: "text-blue-800",
  overdue: "text-red-800",
  paid: "text-emerald-800",
};

function statusLabel(status: BillStatus): string {
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  return "Upcoming";
}

/** Unpaid bills first by due date ascending, then paid bills at the end. */
function sortBills(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const aPaid = a.status === "paid";
    const bPaid = b.status === "paid";
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

interface BillFormState {
  name: string;
  category: string;
  amount: string;
  dueDate: string;
  recurring: boolean;
}

const EMPTY_FORM: BillFormState = {
  name: "",
  category: "",
  amount: "",
  dueDate: "",
  recurring: false,
};

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

export default function Bills() {
  const { state, addBill, payBill } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BillFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<BillFormField, string>>>({});
  const [payAccountId, setPayAccountId] = useState<string>(DEFAULT_ACCOUNT_ID);
  const [payErrorBillId, setPayErrorBillId] = useState<string | null>(null);

  const confirmedCash = state.cashAccounts.reduce((total, account) => total + account.balanceINR, 0);
  const rows = sortBills(state.bills);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBillInput(form);
    if (Object.keys(result.errors).length > 0 || !result.value) {
      setFormErrors(result.errors);
      return;
    }
    addBill(createBill(result.value, nextBillId(state.bills)));
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowForm(false);
  }

  function handlePay(billId: string) {
    const ok = payBill(billId, payAccountId);
    setPayErrorBillId(ok ? null : billId);
  }

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Bills</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmed cash (today)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatINR(confirmedCash)}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Projected cash is shown on the Cash Forecast screen.
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <label htmlFor="pay-from-account" className="block text-sm font-medium text-slate-700">
            Pay from
          </label>
          <select
            id="pay-from-account"
            data-testid="account-select"
            value={payAccountId}
            onChange={(event) => setPayAccountId(event.target.value)}
            className={INPUT_CLASS + " md:w-72"}
          >
            {state.cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 md:w-auto"
        >
          {showForm ? "Close" : "Add bill"}
        </button>
      </div>

      {showForm ? (
        <form
          data-testid="add-bill-form"
          noValidate
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="bill-title" className="block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                id="bill-title"
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={INPUT_CLASS}
              />
              {formErrors.name ? <p className="mt-1 text-sm text-red-600">{formErrors.name}</p> : null}
            </div>
            <div className="min-w-0">
              <label htmlFor="bill-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <input
                id="bill-category"
                type="text"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={INPUT_CLASS}
              />
              {formErrors.category ? <p className="mt-1 text-sm text-red-600">{formErrors.category}</p> : null}
            </div>
            <div className="min-w-0">
              <label htmlFor="bill-amount" className="block text-sm font-medium text-slate-700">
                Amount (INR)
              </label>
              <input
                id="bill-amount"
                type="number"
                min={0}
                step={1}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className={INPUT_CLASS}
              />
              {formErrors.amount ? <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p> : null}
            </div>
            <div className="min-w-0">
              <label htmlFor="bill-due-date" className="block text-sm font-medium text-slate-700">
                Due date
              </label>
              <input
                id="bill-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                className={INPUT_CLASS}
              />
              {formErrors.dueDate ? <p className="mt-1 text-sm text-red-600">{formErrors.dueDate}</p> : null}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Recurring monthly
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 md:w-auto"
          >
            Save bill
          </button>
        </form>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
            No bills yet.
          </p>
        ) : null}
        {rows.map((bill) => {
          const isPaid = bill.status === "paid";
          const isRecurring = bill.recurrence !== "one-time";
          return (
            <div
              key={bill.id}
              data-testid="bill-row"
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-medium text-slate-900">{bill.name}</span>
                  <span className={`text-xs font-medium ${STATUS_STYLES[bill.status]}`}>
                    {statusLabel(bill.status)}
                  </span>
                </div>
                <p className="break-words text-sm text-slate-500">
                  {bill.category} · {RECURRENCE_LABELS[bill.recurrence]}
                </p>
                <p className="text-sm tabular-nums text-slate-700">
                  <span className="tabular-nums">{formatINR(bill.amountINR)}</span> · Due {formatDate(bill.dueDate)}
                </p>
                {payErrorBillId === bill.id ? (
                  <p className="text-sm text-red-600">Bill could not be paid.</p>
                ) : null}
              </div>
              {isPaid ? null : (
                <button
                  type="button"
                  data-testid="pay-button"
                  onClick={() => handlePay(bill.id)}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 md:w-auto"
                >
                  {isRecurring ? "Mark occurrence paid" : "Mark paid"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
