import { useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { TODAY, clients, followUps, invoices } from "../data/seed";
import type { Invoice, InvoiceStatus } from "../types";
import { daysBetween, formatDate, formatINR } from "../utils/format";
import { followUpsFor, needsReminder, outstandingByClient } from "../utils/invoices";

type FilterTab = "all" | InvoiceStatus;

interface TabDef {
  id: FilterTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
];

function clientName(clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
}

function daysOverdue(invoice: Invoice): number {
  return invoice.status !== "paid" && invoice.dueDate < TODAY ? daysBetween(invoice.dueDate, TODAY) : 0;
}

export default function Invoices() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = invoices
    .filter((invoice) => activeTab === "all" || invoice.status === activeTab)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function tabCount(tab: FilterTab): number {
    return tab === "all" ? invoices.length : invoices.filter((invoice) => invoice.status === tab).length;
  }

  const balances = outstandingByClient(clients, invoices);
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const selectedFollowUps = selectedInvoice ? followUpsFor(selectedInvoice.id, followUps) : [];

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">All Invoices</h2>
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
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Issue Date</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 text-right font-medium">Days Overdue</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((invoice) => {
                const late = daysOverdue(invoice);
                const isSelected = invoice.id === selectedId;
                const reminder = needsReminder(invoice, followUps, TODAY);
                return (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelectedId(invoice.id)}
                    className={`cursor-pointer text-slate-700 ${isSelected ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <span className="block font-medium text-slate-900">{invoice.id}</span>
                      <span className="block text-xs text-slate-500">{invoice.description}</span>
                    </td>
                    <td className="px-5 py-3">{clientName(invoice.clientId)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatINR(invoice.amountINR)}</td>
                    <td className="px-5 py-3">{formatDate(invoice.issueDate)}</td>
                    <td className="px-5 py-3">{formatDate(invoice.dueDate)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${late > 0 ? "text-red-700" : ""}`}>
                      {late}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-5 py-3">
                      {reminder ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Follow up
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    No invoices in this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Client Balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">City</th>
                <th className="px-5 py-3 text-right font-medium">Unpaid Invoices</th>
                <th className="px-5 py-3 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((balance) => (
                <tr key={balance.client.id} className="text-slate-700">
                  <td className="px-5 py-3 font-medium text-slate-900">{balance.client.name}</td>
                  <td className="px-5 py-3">{balance.client.city}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{balance.invoiceCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatINR(balance.outstandingINR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Follow-Up History</h2>
        </div>
        <div className="px-5 py-4 text-sm">
          {selectedInvoice === null ? (
            <p className="text-slate-500">Select an invoice to see its follow-up history.</p>
          ) : selectedFollowUps.length === 0 ? (
            <p className="text-slate-500">No follow-ups recorded for this invoice.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {selectedFollowUps.map((followUp) => (
                <li key={followUp.id} className="py-3 text-slate-700">
                  <span className="font-medium text-slate-900">{formatDate(followUp.date)}</span>
                  <span className="ml-3 text-xs capitalize text-slate-500">{followUp.channel}</span>
                  <p className="mt-1">{followUp.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
