// Shared app state for the demo. React context + useReducer.
// State is persisted to localStorage via src/state/persistence.ts; reset clears the saved copy and restores the seed.
// Seed arrays are copied on init and on reset so the seed module is never mutated.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { TODAY, bills as seedBills, cashAccounts as seedCashAccounts, invoices as seedInvoices, payments as seedPayments } from "../data/seed";
import type { Bill, BillPayment, CashAccount, Invoice, Payment } from "../types";
import { payBill } from "../utils/bills";
import { backupRawData, clearPersistedData, loadPersistedData, savePersistedData } from "./persistence";
import type { LoadResult, PersistedData } from "./persistence";

const UNAVAILABLE_NOTICE =
  "Browser storage is unavailable, so changes will not be kept after you reload. Demo data is shown.";
const BACKED_UP_NOTICE =
  "Previously saved data could not be read and was replaced with demo data. A copy of the original was kept under the storage key ps01-back-office:state:corrupt-backup.";
const NOT_BACKED_UP_NOTICE =
  "Previously saved data could not be read and was replaced with demo data. A copy could not be kept because browser storage is unavailable.";

/**
 * Notice text for a recovered load. Unreadable data is copied to the corrupt-backup key before the first save
 * overwrites the main key. Raw data and technical reasons are never shown to the user.
 */
function noticeForRecovered(result: Extract<LoadResult, { status: "recovered" }>): string {
  if (result.raw === null) return UNAVAILABLE_NOTICE;
  return backupRawData(result.raw) ? BACKED_UP_NOTICE : NOT_BACKED_UP_NOTICE;
}

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

function createInitialState(resetCount: number, persisted?: PersistedData | null): AppState {
  if (persisted) {
    return {
      bills: persisted.bills,
      billPayments: persisted.billPayments,
      cashAccounts: persisted.cashAccounts,
      invoices: persisted.invoices,
      payments: persisted.payments,
      resetCount,
    };
  }
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
  /** Set when saved data was ignored at startup (e.g. unreadable or invalid); null otherwise. Cleared by resetDemo. */
  persistenceNotice: string | null;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Loaded once per mount; the lazy initialiser means no second read on re-render.
  // Backup of unreadable data happens here, during initialisation, so it always runs before the save effect below.
  const [boot] = useState(() => {
    const result = loadPersistedData();
    return { result, notice: result.status === "recovered" ? noticeForRecovered(result) : null };
  });
  const [state, dispatch] = useReducer(appStateReducer, boot.result, (loaded) =>
    createInitialState(0, loaded.status === "loaded" ? loaded.data : null),
  );
  const [persistenceNotice, setPersistenceNotice] = useState<string | null>(() => boot.notice);

  useEffect(() => {
    savePersistedData({
      bills: state.bills,
      billPayments: state.billPayments,
      cashAccounts: state.cashAccounts,
      invoices: state.invoices,
      payments: state.payments,
    });
  }, [state.bills, state.billPayments, state.cashAccounts, state.invoices, state.payments]);

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
    clearPersistedData();
    setPersistenceNotice(null);
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, addBill, payBill: payBillAction, resetDemo, persistenceNotice }),
    [state, addBill, payBillAction, resetDemo, persistenceNotice],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>.");
  return ctx;
}
