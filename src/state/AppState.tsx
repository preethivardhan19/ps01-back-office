// Shared in-memory app state for the demo. React context + useReducer; no persistence.
// Seed arrays are copied on init and on reset so the seed module is never mutated.

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { TODAY, bills as seedBills, cashAccounts as seedCashAccounts, invoices as seedInvoices, payments as seedPayments } from "../data/seed";
import type { Bill, BillPayment, CashAccount, Invoice, Payment } from "../types";
import { payBill } from "../utils/bills";

export interface AppState {
  bills: Bill[];
  billPayments: BillPayment[];
  cashAccounts: CashAccount[];
  invoices: Invoice[];
  payments: Payment[];
  /** Incremented on every reset so screens can remount and clear local What-If/filter state. */
  resetCount: number;
}

export type AppAction =
  | { type: "addBill"; bill: Bill }
  | { type: "payBill"; billId: string; accountId: string; paymentId: string }
  | { type: "reset" };

function createInitialState(resetCount: number): AppState {
  return {
    bills: seedBills.map((b) => ({ ...b })),
    billPayments: [],
    cashAccounts: seedCashAccounts.map((a) => ({ ...a })),
    invoices: seedInvoices.map((i) => ({ ...i })),
    payments: seedPayments.map((p) => ({ ...p })),
    resetCount,
  };
}

/** Next bill id in the form "B-NN" (e.g. B-07), based on the highest existing numeric suffix. Pure. */
export function nextBillId(bills: Bill[]): string {
  let max = 0;
  for (const b of bills) {
    const match = /^B-(\d+)$/.exec(b.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return "B-" + String(max + 1).padStart(2, "0");
}

function generatePaymentId(): string {
  return "BP-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "addBill":
      return { ...state, bills: [...state.bills, action.bill] };

    case "payBill": {
      const result = payBill(
        { bills: state.bills, billPayments: state.billPayments, cashAccounts: state.cashAccounts },
        { billId: action.billId, accountId: action.accountId, paidDate: TODAY, paymentId: action.paymentId },
      );
      if (!result.ok) return state;
      return {
        ...state,
        bills: result.state.bills,
        billPayments: result.state.billPayments,
        cashAccounts: result.state.cashAccounts,
      };
    }

    case "reset":
      return createInitialState(state.resetCount + 1);

    default:
      return state;
  }
}

export interface AppStateContextValue {
  state: AppState;
  addBill: (bill: Bill) => void;
  /** Returns true if the payment was applied, false if rejected (already paid, unknown bill/account). */
  payBill: (billId: string, accountId: string, paymentId?: string) => boolean;
  resetDemo: () => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, 0, createInitialState);

  const addBill = useCallback((bill: Bill) => {
    dispatch({ type: "addBill", bill });
  }, []);

  const payBillAction = useCallback(
    (billId: string, accountId: string, paymentId?: string): boolean => {
      const id = paymentId ?? generatePaymentId();
      // Validate against the current render's state so the caller gets an accurate boolean.
      // The reducer re-checks with the same util, so a rejected payment never changes state.
      const check = payBill(
        { bills: state.bills, billPayments: state.billPayments, cashAccounts: state.cashAccounts },
        { billId, accountId, paidDate: TODAY, paymentId: id },
      );
      if (!check.ok) return false;
      dispatch({ type: "payBill", billId, accountId, paymentId: id });
      return true;
    },
    [state.bills, state.billPayments, state.cashAccounts],
  );

  const resetDemo = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, addBill, payBill: payBillAction, resetDemo }),
    [state, addBill, payBillAction, resetDemo],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>.");
  return ctx;
}
