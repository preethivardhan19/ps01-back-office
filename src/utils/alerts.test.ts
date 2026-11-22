import { describe, expect, it } from "vitest";
import type { Bill, CashAccount, Client, Invoice, InvoiceStatus, BillStatus, Recurrence } from "../types";
import { addDays } from "./format";
import { buildAlerts } from "./alerts";
import type { AlertInputs } from "./alerts";

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
  overrides: Partial<Bill> & { id: string; recurrence: Recurrence; dueDate: string; status?: BillStatus },
): Bill {
  return {
    name: `Bill ${overrides.id}`,
    category: "Test",
    amountINR: 1000,
    status: "upcoming",
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> & { id: string; name: string }): Client {
  return {
    type: "design",
    city: "Pune",
    contact: "placeholder",
    ...overrides,
  };
}

function makeAccount(overrides: Partial<CashAccount> & { id: string; balanceINR: number }): CashAccount {
  return {
    label: `Account ${overrides.id}`,
    asOfDate: START,
    ...overrides,
  };
}

function inputs(overrides: Partial<AlertInputs> = {}): AlertInputs {
  return {
    today: START,
    invoices: [],
    bills: [],
    clients: [],
    cashAccounts: [],
    ...overrides,
  };
}

// A large balance so bill-only tests never trigger the forecast-negative alert.
const RICH_CASH = [makeAccount({ id: "CA-RICH", balanceINR: 1_000_000 })];

describe("buildAlerts", () => {
  it("returns an empty list when there are no invoices, bills or accounts", () => {
    expect(buildAlerts(inputs())).toEqual([]);
  });

  it("creates a high reminder alert for an overdue invoice that names the client and invoice", () => {
    const client = makeClient({ id: "C-09", name: "Horizon Tech" });
    const overdue = makeInvoice({
      id: "INV-O1",
      clientId: "C-09",
      status: "overdue",
      amountINR: 45000,
      dueDate: addDays(START, -3),
    });
    const alerts = buildAlerts(inputs({ invoices: [overdue], clients: [client], cashAccounts: RICH_CASH }));

    expect(alerts).toHaveLength(1);
    const [alert] = alerts;
    expect(alert.id).toBe("invoice-overdue-INV-O1");
    expect(alert.priority).toBe("high");
    expect(alert.action).toEqual({ kind: "invoice", invoiceId: "INV-O1" });
    expect(alert.actionLabel).toBe("Open reminder");
    expect(alert.date).toBe(addDays(START, -3));
    expect(alert.message).toContain("Horizon Tech");
    expect(alert.message).toContain("INV-O1");
  });

  it("treats a sent invoice due in 14 days as medium and one due in 15 days as excluded", () => {
    const dueIn14 = makeInvoice({ id: "INV-14", status: "sent", dueDate: addDays(START, 14) });
    const alerts = buildAlerts(inputs({ invoices: [dueIn14], cashAccounts: RICH_CASH }));

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("invoice-due-INV-14");
    expect(alerts[0].priority).toBe("medium");
    expect(alerts[0].action).toEqual({ kind: "invoice", invoiceId: "INV-14" });

    const dueIn15 = makeInvoice({ id: "INV-15", status: "sent", dueDate: addDays(START, 15) });
    expect(buildAlerts(inputs({ invoices: [dueIn15], cashAccounts: RICH_CASH }))).toEqual([]);
  });

  it("excludes draft and paid invoices even when their due dates are soon", () => {
    const draft = makeInvoice({ id: "INV-D", status: "draft", dueDate: addDays(START, 5) });
    const paid = makeInvoice({ id: "INV-P", status: "paid", dueDate: addDays(START, 5), paidDate: START });
    expect(buildAlerts(inputs({ invoices: [draft, paid], cashAccounts: RICH_CASH }))).toEqual([]);
  });

  it("treats a bill due in 5 days as high with a forecast action, and one due in 20 days as medium", () => {
    const soon = makeBill({ id: "B-SOON", recurrence: "one-time", dueDate: addDays(START, 5) });
    const alerts = buildAlerts(inputs({ bills: [soon], cashAccounts: RICH_CASH }));

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("bill-B-SOON");
    expect(alerts[0].priority).toBe("high");
    expect(alerts[0].action).toEqual({ kind: "forecast" });
    expect(alerts[0].actionLabel).toBe("View cash forecast");

    const later = makeBill({ id: "B-LATER", recurrence: "one-time", dueDate: addDays(START, 20) });
    const mediumAlerts = buildAlerts(inputs({ bills: [later], cashAccounts: RICH_CASH }));
    expect(mediumAlerts).toHaveLength(1);
    expect(mediumAlerts[0].priority).toBe("medium");
  });

  it("excludes a bill due in 31 days and a paid bill", () => {
    const far = makeBill({ id: "B-FAR", recurrence: "one-time", dueDate: addDays(START, 31) });
    const paid = makeBill({ id: "B-PAID", recurrence: "one-time", dueDate: addDays(START, 2), status: "paid" });
    expect(buildAlerts(inputs({ bills: [far, paid], cashAccounts: RICH_CASH }))).toEqual([]);
  });

  it("raises one critical forecast-negative alert dated to the bill that breaks the balance", () => {
    const cash = [makeAccount({ id: "CA-1", balanceINR: 1000 })];
    const bill = makeBill({ id: "B-BIG", recurrence: "one-time", dueDate: addDays(START, 2), amountINR: 5000 });
    const alerts = buildAlerts(inputs({ bills: [bill], cashAccounts: cash }));

    const forecast = alerts.filter((alert) => alert.id === "forecast-negative");
    expect(forecast).toHaveLength(1);
    expect(forecast[0].priority).toBe("critical");
    expect(forecast[0].date).toBe(addDays(START, 2));
    expect(forecast[0].action).toEqual({ kind: "forecast" });
    expect(forecast[0].message).toContain("\u2212");
  });

  describe("cash-positive claim rule", () => {
    it("adds the claim when the baseline is positive and the invoice is what keeps it positive", () => {
      const overdue = makeInvoice({ id: "INV-CLAIM", status: "overdue", amountINR: 10000, dueDate: addDays(START, -3) });
      const bill = makeBill({ id: "B-CLAIM", recurrence: "one-time", dueDate: addDays(START, 1), amountINR: 5000 });
      const alerts = buildAlerts(inputs({ invoices: [overdue], bills: [bill] }));

      const invoiceAlert = alerts.find((alert) => alert.id === "invoice-overdue-INV-CLAIM");
      expect(invoiceAlert?.message).toContain("stay cash-positive");
    });

    it("omits the claim when the baseline is already negative", () => {
      const overdue = makeInvoice({ id: "INV-NEG", status: "overdue", amountINR: 10000, dueDate: addDays(START, -3) });
      const bill = makeBill({ id: "B-NEG", recurrence: "one-time", dueDate: addDays(START, 1), amountINR: 50000 });
      const alerts = buildAlerts(inputs({ invoices: [overdue], bills: [bill] }));

      expect(alerts.some((alert) => alert.id === "forecast-negative")).toBe(true);
      const invoiceAlert = alerts.find((alert) => alert.id === "invoice-overdue-INV-NEG");
      expect(invoiceAlert?.message).not.toContain("stay cash-positive");
    });
  });

  it("orders critical before high before medium, then by date, then by id", () => {
    // Cash 0: overdue inflow of 10000 on day 0, then a 50000 bill on day 5 makes the forecast negative.
    const overdue = makeInvoice({ id: "INV-O", status: "overdue", amountINR: 10000, dueDate: addDays(START, -3) });
    const highBill = makeBill({ id: "B-HIGH", recurrence: "one-time", dueDate: addDays(START, 5), amountINR: 50000 });
    const mediumInvoice = makeInvoice({ id: "INV-M", status: "sent", amountINR: 10000, dueDate: addDays(START, 10) });
    const mediumBill = makeBill({ id: "B-MED", recurrence: "one-time", dueDate: addDays(START, 20) });

    const alerts = buildAlerts(
      inputs({ invoices: [mediumInvoice, overdue], bills: [mediumBill, highBill] }),
    );

    expect(alerts.map((alert) => alert.id)).toEqual([
      "forecast-negative",
      "invoice-overdue-INV-O",
      "bill-B-HIGH",
      "invoice-due-INV-M",
      "bill-B-MED",
    ]);
    expect(alerts.map((alert) => alert.priority)).toEqual(["critical", "high", "high", "medium", "medium"]);
  });

  it("breaks ties between equal priority and date by id", () => {
    const invoiceB = makeInvoice({ id: "INV-b", status: "sent", dueDate: addDays(START, 7) });
    const invoiceA = makeInvoice({ id: "INV-a", status: "sent", dueDate: addDays(START, 7) });
    const alerts = buildAlerts(inputs({ invoices: [invoiceB, invoiceA], cashAccounts: RICH_CASH }));

    expect(alerts.map((alert) => alert.id)).toEqual(["invoice-due-INV-a", "invoice-due-INV-b"]);
  });

  it("gives every invoice alert a unique id and an action carrying that exact invoice id", () => {
    const invoices = [
      makeInvoice({ id: "INV-X1", status: "overdue", dueDate: addDays(START, -1) }),
      makeInvoice({ id: "INV-X2", status: "overdue", dueDate: addDays(START, -2) }),
      makeInvoice({ id: "INV-X3", status: "sent", dueDate: addDays(START, 4) }),
    ];
    const alerts = buildAlerts(inputs({ invoices, cashAccounts: RICH_CASH }));
    const invoiceAlerts = alerts.filter((alert) => alert.action.kind === "invoice");

    expect(invoiceAlerts).toHaveLength(3);
    expect(new Set(invoiceAlerts.map((alert) => alert.id)).size).toBe(3);
    for (const alert of invoiceAlerts) {
      const invoiceId = alert.id.split("-").slice(-2).join("-");
      expect(alert.action).toEqual({ kind: "invoice", invoiceId });
    }
  });

  it("does not mutate its input arrays", () => {
    const invoices = [
      makeInvoice({ id: "INV-M1", status: "overdue", dueDate: addDays(START, -3) }),
      makeInvoice({ id: "INV-M2", status: "sent", dueDate: addDays(START, 6) }),
    ];
    const bills = [makeBill({ id: "B-M1", recurrence: "monthly", dueDate: addDays(START, 2), amountINR: 5000 })];
    const clients = [makeClient({ id: "C-01", name: "Kaveri Textiles" })];
    const cashAccounts = [makeAccount({ id: "CA-M1", balanceINR: 1000 })];
    const before = JSON.parse(JSON.stringify({ invoices, bills, clients, cashAccounts }));

    buildAlerts({ today: START, invoices, bills, clients, cashAccounts });

    expect({ invoices, bills, clients, cashAccounts }).toEqual(before);
  });
});
