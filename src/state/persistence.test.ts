import { describe, expect, it, vi } from "vitest";
import { bills as seedBills, cashAccounts as seedCashAccounts, invoices as seedInvoices, payments as seedPayments } from "../data/seed";
import type { BillPayment } from "../types";
import { appStateReducer, type AppState } from "./AppState";
import {
  CORRUPT_BACKUP_KEY,
  STORAGE_KEY,
  backupRawData,
  clearPersistedData,
  loadPersistedData,
  savePersistedData,
  validatePersistedData,
  type PersistedData,
} from "./persistence";

const INCOMPATIBLE = "Saved data is from an incompatible version; using demo data.";
const UNREADABLE = "Saved data was unreadable; using demo data.";
const INVALID = "Saved data failed validation; using demo data.";

/** In-memory Storage stand-in; only the three methods the persistence module uses are implemented. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } as unknown as Storage;
}

function seedData(): PersistedData {
  return structuredClone({
    bills: seedBills,
    billPayments: [] as BillPayment[],
    cashAccounts: seedCashAccounts,
    invoices: seedInvoices,
    payments: seedPayments,
  });
}

/** Writes raw text straight into storage, bypassing save, to simulate corrupt or foreign data. */
function writeRaw(storage: Storage, text: string): void {
  storage.setItem(STORAGE_KEY, text);
}

function writeEnvelope(storage: Storage, data: unknown, version: unknown = 1): void {
  writeRaw(storage, JSON.stringify({ version, data }));
}

describe("persistence round trip", () => {
  it("loads back seed-shaped data equal to what was saved", () => {
    const storage = fakeStorage();
    const data = seedData();

    expect(savePersistedData(data, storage)).toBe(true);
    const result = loadPersistedData(storage);

    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.data).toEqual(data);
    }
  });

  it("returns empty when nothing has been saved yet", () => {
    expect(loadPersistedData(fakeStorage())).toEqual({ status: "empty" });
  });

  it("clearPersistedData removes the key so loading returns empty", () => {
    const storage = fakeStorage();
    savePersistedData(seedData(), storage);

    expect(clearPersistedData(storage)).toBe(true);
    expect(loadPersistedData(storage)).toEqual({ status: "empty" });
  });
});

describe("storage availability", () => {
  it("returns empty when there is no storage at all", () => {
    expect(loadPersistedData(null)).toEqual({ status: "empty" });
    expect(savePersistedData(seedData(), null)).toBe(false);
    expect(clearPersistedData(null)).toBe(false);
  });

  it("recovers when reading storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage;

    expect(loadPersistedData(storage)).toEqual({
      status: "recovered",
      reason: "Storage is unavailable; using demo data.",
      raw: null,
    });
  });

  it("returns false without throwing when writing storage throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    } as unknown as Storage;

    expect(savePersistedData(seedData(), storage)).toBe(false);
    warn.mockRestore();
  });
});

describe("loadPersistedData recovery", () => {
  it("recovers from corrupt JSON", () => {
    const storage = fakeStorage();
    writeRaw(storage, "{not json");

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: UNREADABLE, raw: expect.any(String) });
  });

  it("recovers from an incompatible schema version", () => {
    const storage = fakeStorage();
    writeEnvelope(storage, seedData(), 99);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INCOMPATIBLE, raw: expect.any(String) });
  });

  it("recovers when an array field is missing", () => {
    const storage = fakeStorage();
    const data: Partial<PersistedData> = seedData();
    delete data.payments;
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when a bill amount is a string", () => {
    const storage = fakeStorage();
    const data = seedData();
    (data.bills[0] as unknown as { amountINR: unknown }).amountINR = "100";
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when a bill date is an impossible calendar date", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.bills[0] = { ...data.bills[0], dueDate: "2026-02-30" };
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when an invoice status is not a known value", () => {
    const storage = fakeStorage();
    const data = seedData();
    (data.invoices[0] as unknown as { status: string }).status = "weird";
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when an amount is negative", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.bills[0] = { ...data.bills[0], amountINR: -5 };
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when two bills share an id", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.bills[1] = { ...data.bills[1], id: data.bills[0].id };
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when a bill payment references a missing bill", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.billPayments = [
      {
        id: "BP-1",
        billId: "B-MISSING",
        accountId: seedCashAccounts[0].id,
        amountINR: 1000,
        paidDate: "2025-06-15",
        occurrenceDueDate: "2025-06-20",
      },
    ];
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when a bill payment references a missing cash account", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.billPayments = [
      {
        id: "BP-1",
        billId: seedBills[0].id,
        accountId: "CA-MISSING",
        amountINR: 1000,
        paidDate: "2025-06-15",
        occurrenceDueDate: "2025-06-20",
      },
    ];
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("recovers when a payment references a missing invoice", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.payments = [{ id: "P-X", invoiceId: "INV-MISSING", amountINR: 1000, receivedDate: "2025-06-15" }];
    writeEnvelope(storage, data);

    expect(loadPersistedData(storage)).toEqual({ status: "recovered", reason: INVALID, raw: expect.any(String) });
  });

  it("accepts two legitimately separate bills that share a name and amount", () => {
    const storage = fakeStorage();
    const data = seedData();
    data.bills.push({ ...data.bills[0], id: "B-DUP-LOOKALIKE" });
    writeEnvelope(storage, data);

    const result = loadPersistedData(storage);
    expect(result.status).toBe("loaded");
  });
});

describe("validatePersistedData", () => {
  it("returns null for a non-object value", () => {
    expect(validatePersistedData(null)).toBeNull();
    expect(validatePersistedData([])).toBeNull();
    expect(validatePersistedData("text")).toBeNull();
  });

  it("returns copies of the arrays, not the input references", () => {
    const input = seedData();
    const validated = validatePersistedData(input);

    expect(validated).not.toBeNull();
    expect(validated?.bills).not.toBe(input.bills);
    expect(validated?.bills[0]).not.toBe(input.bills[0]);
  });
});

describe("appStateReducer reset with persisted billPayments", () => {
  it("clears billPayments and restores the seed bills and cash accounts", () => {
    const state: AppState = {
      bills: seedBills.map((bill) => ({ ...bill, status: "paid" as const })),
      billPayments: [
        {
          id: "BP-1",
          billId: seedBills[0].id,
          accountId: seedCashAccounts[0].id,
          amountINR: seedBills[0].amountINR,
          paidDate: "2025-06-15",
          occurrenceDueDate: seedBills[0].dueDate,
        },
      ],
      cashAccounts: seedCashAccounts.map((account) => ({ ...account, balanceINR: 0 })),
      invoices: seedInvoices,
      payments: seedPayments,
      resetCount: 3,
    };

    const next = appStateReducer(state, { type: "reset" });

    expect(next.billPayments).toEqual([]);
    expect(next.bills).toEqual(seedBills);
    expect(next.cashAccounts).toEqual(seedCashAccounts);
    expect(next.resetCount).toBe(4);
  });
});

describe("Slice 08 corrupt-data handling", () => {
  it("returns recovered with raw equal to the exact corrupt string", () => {
    const storage = fakeStorage();
    const corrupt = "{not json";
    writeRaw(storage, corrupt);

    const result = loadPersistedData(storage);
    expect(result.status).toBe("recovered");
    if (result.status === "recovered") {
      expect(result.raw).toBe(corrupt);
    }
  });

  it("returns recovered with raw null when reading storage throws, and empty when there is no storage object", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage;

    const result = loadPersistedData(throwing);
    expect(result.status).toBe("recovered");
    if (result.status === "recovered") {
      expect(result.raw).toBeNull();
    }
    expect(loadPersistedData(null)).toEqual({ status: "empty" });
  });

  it("backupRawData writes the raw string under CORRUPT_BACKUP_KEY and returns true", () => {
    const storage = fakeStorage();
    const corrupt = "{not json";

    expect(backupRawData(corrupt, storage)).toBe(true);
    expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBe(corrupt);
  });

  it("backupRawData returns false without throwing when setItem throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    } as unknown as Storage;

    expect(() => backupRawData("{not json", storage)).not.toThrow();
    expect(backupRawData("{not json", storage)).toBe(false);
    warn.mockRestore();
  });

  it("leaves the original STORAGE_KEY value untouched after backing up corrupt data", () => {
    const storage = fakeStorage();
    const corrupt = "{not json";
    writeRaw(storage, corrupt);

    const result = loadPersistedData(storage);
    if (result.status === "recovered" && result.raw !== null) {
      backupRawData(result.raw, storage);
    }

    expect(storage.getItem(STORAGE_KEY)).toBe(corrupt);
    expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBe(corrupt);
  });
});
