import { useState } from "react";
import { clients, TODAY } from "../data/seed";
import type { Invoice } from "../types";
import { formatDate, formatINR } from "../utils/format";
import { badDaySelection, eligibleWhatIfInvoices } from "../utils/whatIfForecast";

const MAX_DELAY_DAYS = 45;
const LATE_DAYS = 15;
const BAD_DAY_CLIENT_TARGET = 5;

interface WhatIfSimulatorProps {
  invoices: Invoice[];
  delays: Record<string, number>;
  onDelaysChange: (next: Record<string, number>) => void;
  onReset: () => void;
  shortfall: { date: string; shortfallINR: number } | null;
}

/** Returns a copy of the delay map with one invoice set to `days`; zero or less removes the entry. */
function withDelay(base: Record<string, number>, invoiceId: string, days: number): Record<string, number> {
  const next = { ...base };
  if (days > 0) {
    next[invoiceId] = days;
  } else {
    delete next[invoiceId];
  }
  return next;
}

export default function WhatIfSimulator({
  invoices,
  delays,
  onDelaysChange,
  onReset,
  shortfall,
}: WhatIfSimulatorProps) {
  const eligible = eligibleWhatIfInvoices(invoices);
  const [selectedId, setSelectedId] = useState<string>(eligible[0]?.id ?? "");
  const hasInvoices = eligible.length > 0;
  const selectedDelay = delays[selectedId] ?? 0;

  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const clientName = (clientId: string): string => clientNameById.get(clientId) ?? clientId;

  const badDay = badDaySelection(invoices, TODAY);
  const badDayCountLabel =
    badDay.availableClientCount < BAD_DAY_CLIENT_TARGET
      ? `${badDay.availableClientCount} of ${BAD_DAY_CLIENT_TARGET} clients available`
      : `${BAD_DAY_CLIENT_TARGET} clients`;

  const handleBadDay = () => {
    const next = { ...delays };
    for (const invoiceId of badDay.invoiceIds) {
      next[invoiceId] = LATE_DAYS;
    }
    onDelaysChange(next);
  };

  const handleReset = () => {
    setSelectedId(eligible[0]?.id ?? "");
    onReset();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">What-If Simulator</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-500">
          Invoice
          <select
            value={hasInvoices ? selectedId : ""}
            disabled={!hasInvoices}
            onChange={(event) => setSelectedId(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm tabular-nums text-slate-900"
          >
            {hasInvoices ? (
              eligible.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {`${invoice.id} · ${clientName(invoice.clientId)} · ${formatINR(invoice.amountINR)}`}
                </option>
              ))
            ) : (
              <option value="">No unpaid invoices</option>
            )}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm text-slate-500">
          <span>
            Delay: <span className="font-medium tabular-nums text-slate-900">{selectedDelay} days</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_DELAY_DAYS}
            step={1}
            value={selectedDelay}
            disabled={!hasInvoices}
            aria-label="Delay in days"
            onChange={(event) => onDelaysChange(withDelay(delays, selectedId, Number(event.target.value)))}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!hasInvoices}
          onClick={() => onDelaysChange(withDelay(delays, selectedId, LATE_DAYS))}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          +15 days late
        </button>
        <button
          type="button"
          disabled={badDay.clientIds.length === 0}
          onClick={handleBadDay}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bad Day: 5 Late Clients
        </button>
        <span className="text-sm text-slate-500">{badDayCountLabel}</span>
        <button
          type="button"
          onClick={handleReset}
          className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Reset Scenario
        </button>
      </div>

      {shortfall !== null && (
        <div className="mt-4 text-sm font-medium text-red-700">
          <p className="tabular-nums">{`Cash goes negative on ${formatDate(shortfall.date)}`}</p>
          <p className="tabular-nums">{`Shortfall: \u2212${formatINR(shortfall.shortfallINR)}`}</p>
        </div>
      )}
    </div>
  );
}
