import { useEffect } from "react";
import StatusBadge from "./StatusBadge";
import { TODAY, clients, followUps, invoices } from "../data/seed";
import { followUpsFor } from "../utils/invoices";
import { daysBetween, formatDate, formatINR } from "../utils/format";

interface ReminderDrawerProps {
  invoiceId: string | null;
  onClose: () => void;
}

const HEADING_ID = "reminder-drawer-title";

function clientName(clientId: string): string {
  return clients.find((client) => client.id === clientId)?.name ?? "Unknown client";
}

export default function ReminderDrawer({ invoiceId, onClose }: ReminderDrawerProps) {
  // Close on Escape only while the drawer is open.
  useEffect(() => {
    if (invoiceId === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invoiceId, onClose]);

  if (invoiceId === null) return null;

  const invoice = invoices.find((item) => item.id === invoiceId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        className="relative flex h-full w-full flex-col bg-white shadow-xl md:max-w-md"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 id={HEADING_ID} className="min-w-0 break-words text-lg font-semibold text-slate-900">
            {invoice ? `Invoice ${invoice.id}` : "Invoice not found"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {invoice === undefined ? (
          <div className="px-5 py-4 text-sm text-slate-700">
            <p>
              No invoice matches the id <span className="font-medium text-slate-900">{invoiceId}</span>.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Client</dt>
                <dd className="break-words font-medium text-slate-900">{clientName(invoice.clientId)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Invoice</dt>
                <dd className="break-words text-slate-900">{invoice.id}</dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Description</dt>
                <dd className="break-words">{invoice.description}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Amount</dt>
                <dd className="tabular-nums text-slate-900">{formatINR(invoice.amountINR)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={invoice.status} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Issue date</dt>
                <dd>{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Due date</dt>
                <dd>{formatDate(invoice.dueDate)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Days overdue</dt>
                <dd className="tabular-nums">
                  {invoice.dueDate < TODAY ? daysBetween(invoice.dueDate, TODAY) : 0}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Follow-up history</h3>
              {(() => {
                const history = followUpsFor(invoice.id, followUps);
                if (history.length === 0) {
                  return <p className="mt-2 text-slate-500">No follow-ups logged</p>;
                }
                return (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {history.map((followUp) => (
                      <li key={followUp.id} className="py-3 text-slate-700">
                        <span className="font-medium text-slate-900">{formatDate(followUp.date)}</span>
                        <span className="ml-3 text-xs capitalize text-slate-500">{followUp.channel}</span>
                        <p className="mt-1 break-words">{followUp.note}</p>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
