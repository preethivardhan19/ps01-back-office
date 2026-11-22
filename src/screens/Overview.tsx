import { useState } from "react";
import AlertsPanel from "../components/AlertsPanel";
import StatCard from "../components/StatCard";
import { TODAY, bills, cashAccounts, clients, invoices } from "../data/seed";
import type { Invoice, InvoiceStatus } from "../types";
import { buildAlerts } from "../utils/alerts";
import { addDays, daysBetween, formatDate, formatINR } from "../utils/format";

type FilterTab = "all" | "overdue" | "sent" | "draft";

interface TabDef {
  id: FilterTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "sent", label: "Sent" },
  { id: "draft", label: "Draft" },
];

const DUE_SOON_DAYS = 14;
const BILLS_WINDOW_DAYS = 30;

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
};

function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function clientName(clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
}

function daysOverdue(invoice: Invoice): number {
  return invoice.dueDate < TODAY ? daysBetween(invoice.dueDate, TODAY) : 0;
}

export default function Overview({
  onOpenInvoice,
  onOpenForecast,
}: {
  onOpenInvoice?: (invoiceId: string) => void;
  onOpenForecast?: () => void;
} = {}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const alerts = buildAlerts({ today: TODAY, invoices, bills, clients, cashAccounts });

  const dueSoonEnd = addDays(TODAY, DUE_SOON_DAYS);
  const billsEnd = addDays(TODAY, BILLS_WINDOW_DAYS);

  const unpaid = invoices.filter((invoice) => invoice.status !== "paid");
  const overdue = unpaid.filter((invoice) => invoice.status === "overdue");
  const dueSoon = unpaid.filter(
    (invoice) => invoice.dueDate >= TODAY && invoice.dueDate <= dueSoonEnd,
  );
  const upcomingBills = bills.filter(
    (bill) => bill.status === "upcoming" && bill.dueDate >= TODAY && bill.dueDate <= billsEnd,
  );
  const currentCash = sumBy(cashAccounts, (account) => account.balanceINR);

  const rows = unpaid
    .filter((invoice) => activeTab === "all" || invoice.status === activeTab)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function tabCount(tab: FilterTab): number {
    return tab === "all" ? unpaid.length : unpaid.filter((invoice) => invoice.status === tab).length;
  }

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      <AlertsPanel
        alerts={alerts}
        onOpenInvoice={(id) => onOpenInvoice?.(id)}
        onOpenForecast={() => onOpenForecast?.()}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current Cash"
          value={formatINR(currentCash)}
          subtitle={`Sum of ${cashAccounts.length} cash account balances`}
        />
        <StatCard
          label="Total Overdue"
          value={formatINR(sumBy(overdue, (invoice) => invoice.amountINR))}
          subtitle={`${overdue.length} overdue ${overdue.length === 1 ? "invoice" : "invoices"}`}
        />
        <StatCard
          label="Due Next 14 Days"
          value={formatINR(sumBy(dueSoon, (invoice) => invoice.amountINR))}
          subtitle={`${dueSoon.length} unpaid ${dueSoon.length === 1 ? "invoice" : "invoices"} due by ${formatDate(dueSoonEnd)}`}
        />
        <StatCard
          label="Upcoming Bills"
          value={formatINR(sumBy(upcomingBills, (bill) => bill.amountINR))}
          subtitle="Bills with status upcoming, due within 30 days"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Who Owes Me</h2>
          <div role="tablist" aria-label="Filter invoices by status" className="flex gap-1">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    isActive
                      ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  }
                >
                  {tab.label} ({tabCount(tab.id)})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 text-right font-medium">Days Overdue</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((invoice) => {
                const late = daysOverdue(invoice);
                return (
                  <tr key={invoice.id} className="text-slate-700">
                    <td className="px-5 py-3 font-medium text-slate-900">{clientName(invoice.clientId)}</td>
                    <td className="px-5 py-3">
                      <span className="block">{invoice.id}</span>
                      <span className="block text-xs text-slate-500">{invoice.description}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatINR(invoice.amountINR)}</td>
                    <td className="px-5 py-3">{formatDate(invoice.dueDate)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${late > 0 ? "text-red-700" : ""}`}>
                      {late}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No invoices in this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
