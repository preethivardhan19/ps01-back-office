// Versioned localStorage persistence for the mutable demo state.
// Every load path is defensive: any problem yields a "recovered" result (or "empty"), never an exception.
// Saved data is validated in full before use; anything malformed falls back to the seed data.

import type { Bill, BillPayment, CashAccount, Invoice, Payment } from "../types";
import { isValidIsoDate } from "../utils/bills";

export const STORAGE_KEY = "ps01-back-office:state";
export const CORRUPT_BACKUP_KEY = "ps01-back-office:state:corrupt-backup";
export const SCHEMA_VERSION = 1;

/** The persistable subset of app state. resetCount is session-only and is not stored. */
export interface PersistedData {
  bills: Bill[];
  billPayments: BillPayment[];
  cashAccounts: CashAccount[];
  invoices: Invoice[];
  payments: Payment[];
}

export type LoadResult =
  | { status: "loaded"; data: PersistedData }
  | { status: "empty" }
  | { status: "recovered"; reason: string; raw: string | null };

const BILL_STATUSES = ["upcoming", "paid", "overdue"] as const;
const RECURRENCES = ["one-time", "monthly", "quarterly", "yearly"] as const;
const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeAmount(value: unknown): value is number {
  return isFiniteAmount(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isValidIsoDate(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** An optional field is absent (undefined) or passes the given check. */
function isOptional(record: Record<string, unknown>, key: string, check: (value: unknown) => boolean): boolean {
  return record[key] === undefined || check(record[key]);
}

function isBill(value: unknown): value is Bill {
  if (!isPlainObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    isNonNegativeAmount(value.amountINR) &&
    isIsoDate(value.dueDate) &&
    isOneOf(value.status, BILL_STATUSES) &&
    isOneOf(value.recurrence, RECURRENCES) &&
    isOptional(value, "anchorDate", isIsoDate)
  );
}

function isBillPayment(value: unknown): value is BillPayment {
  if (!isPlainObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.billId) &&
    isNonEmptyString(value.accountId) &&
    isNonNegativeAmount(value.amountINR) &&
    isIsoDate(value.paidDate) &&
    isIsoDate(value.occurrenceDueDate)
  );
}

function isCashAccount(value: unknown): value is CashAccount {
  if (!isPlainObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    typeof value.label === "string" &&
    isFiniteAmount(value.balanceINR) &&
    isIsoDate(value.asOfDate)
  );
}

function isInvoice(value: unknown): value is Invoice {
  if (!isPlainObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    typeof value.clientId === "string" &&
    typeof value.description === "string" &&
    isNonNegativeAmount(value.amountINR) &&
    isIsoDate(value.issueDate) &&
    isIsoDate(value.dueDate) &&
    isOneOf(value.status, INVOICE_STATUSES) &&
    isOptional(value, "paidDate", isIsoDate)
  );
}

function isPayment(value: unknown): value is Payment {
  if (!isPlainObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.invoiceId) &&
    isNonNegativeAmount(value.amountINR) &&
    isIsoDate(value.receivedDate)
  );
}

/** Returns shallow copies of the items if `value` is an array whose every item passes `guard`; otherwise null. */
function parseList<T>(value: unknown, guard: (item: unknown) => item is T): T[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(guard)) return null;
  return value.map((item) => ({ ...item }));
}

function idsAreUnique(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

/**
 * Full schema check of persisted data. Returns a new object with copied arrays, or null on ANY problem:
 * wrong shapes or types, invalid enums or dates, negative/non-finite amounts, duplicate ids,
 * or broken references (billPayment -> bill/account, payment -> invoice).
 */
export function validatePersistedData(value: unknown): PersistedData | null {
  if (!isPlainObject(value)) return null;

  const bills = parseList(value.bills, isBill);
  const billPayments = parseList(value.billPayments, isBillPayment);
  const cashAccounts = parseList(value.cashAccounts, isCashAccount);
  const invoices = parseList(value.invoices, isInvoice);
  const payments = parseList(value.payments, isPayment);
  if (!bills || !billPayments || !cashAccounts || !invoices || !payments) return null;

  if (!idsAreUnique(bills) || !idsAreUnique(billPayments) || !idsAreUnique(cashAccounts)) return null;
  if (!idsAreUnique(invoices) || !idsAreUnique(payments)) return null;

  const billIds = new Set(bills.map((bill) => bill.id));
  const accountIds = new Set(cashAccounts.map((account) => account.id));
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));

  if (!billPayments.every((payment) => billIds.has(payment.billId) && accountIds.has(payment.accountId))) return null;
  if (!payments.every((payment) => invoiceIds.has(payment.invoiceId))) return null;

  return { bills, billPayments, cashAccounts, invoices, payments };
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    // Accessing localStorage can throw (e.g. disabled cookies or sandboxed iframes).
    return null;
  }
}

/**
 * Reads and validates saved state. Never throws. Returns "empty" when nothing is saved (or no storage object exists);
 * any other problem yields "recovered", with `raw` holding the exact stored string (null if storage could not be read).
 */
export function loadPersistedData(storage: Storage | null | undefined = getStorage()): LoadResult {
  if (!storage) return { status: "empty" };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: "recovered", reason: "Storage is unavailable; using demo data.", raw: null };
  }
  if (raw === null) return { status: "empty" };

  const recover = (reason: string): LoadResult => ({ status: "recovered", reason, raw });

  try {
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return recover("Saved data was unreadable; using demo data.");
    }
    if (!isPlainObject(envelope)) {
      return recover("Saved data was unreadable; using demo data.");
    }
    if (envelope.version !== SCHEMA_VERSION) {
      return recover("Saved data is from an incompatible version; using demo data.");
    }

    const data = validatePersistedData(envelope.data);
    if (!data) {
      return recover("Saved data failed validation; using demo data.");
    }
    return { status: "loaded", data };
  } catch {
    return recover("Saved data could not be processed; using demo data.");
  }
}

/** Copies raw text to the corrupt-backup key so it is not lost when the main key is overwritten. Returns true on success. Never throws. */
export function backupRawData(raw: string, storage: Storage | null | undefined = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, raw);
    return true;
  } catch (error) {
    console.warn("Could not back up unreadable saved data.", error);
    return false;
  }
}

/** Writes the persistable state. Returns true on success, false on any failure. Never throws. */
export function savePersistedData(data: PersistedData, storage: Storage | null | undefined = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, data }));
    return true;
  } catch (error) {
    console.warn("Could not save demo data to localStorage.", error);
    return false;
  }
}

/** Removes the saved state. Returns true on success, false on any failure. Never throws. */
export function clearPersistedData(storage: Storage | null | undefined = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Could not clear saved demo data from localStorage.", error);
    return false;
  }
}
