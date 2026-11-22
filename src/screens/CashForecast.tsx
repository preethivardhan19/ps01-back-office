import { useState } from "react";
import ForecastChart from "../components/ForecastChart";
import WhatIfSimulator from "../components/WhatIfSimulator";
import { useAppState } from "../state/AppState";
import { calculateCashForecast, type HorizonDays } from "../utils/cashForecast";
import { formatDate, formatINR } from "../utils/format";
import { firstShortfall, simulateForecast } from "../utils/whatIfForecast";

const HORIZONS: HorizonDays[] = [30, 60, 90];

export default function CashForecast() {
  const [horizon, setHorizon] = useState<HorizonDays>(30);
  const { state } = useAppState();
  const { bills, cashAccounts, invoices } = state;

  const currentCash = cashAccounts.reduce((total, account) => total + account.balanceINR, 0);
  const forecast = calculateCashForecast(currentCash, invoices, bills, horizon);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const simulated = simulateForecast(currentCash, invoices, bills, horizon, delays);
  const shortfall = firstShortfall(simulated);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cash Forecast</h1>
          <p className="mt-1 text-sm text-slate-500">
            Projection only — based on unpaid invoice due dates and scheduled bills; not guaranteed payments.
          </p>
        </div>
        <div role="tablist" aria-label="Forecast horizon" className="flex gap-1">
          {HORIZONS.map((days) => {
            const isActive = days === horizon;
            return (
              <button
                key={days}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setHorizon(days)}
                className={
                  isActive
                    ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                }
              >
                {days} days
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Confirmed cash (today)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{formatINR(currentCash)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Projected cash: lowest balance</p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              forecast.lowestBalanceINR < 0 ? "text-red-700" : "text-slate-900"
            }`}
          >
            {formatINR(forecast.lowestBalanceINR)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Projected cash: first negative date</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {forecast.firstNegativeDate === null ? "None in this horizon" : formatDate(forecast.firstNegativeDate)}
          </p>
        </div>
      </div>

      <p className="-mt-4 text-sm text-slate-500">Projected cash excludes bills already paid, so no bill is counted twice.</p>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <ForecastChart days={forecast.days} simulatedDays={simulated.days} />
      </div>

      <WhatIfSimulator
        invoices={invoices}
        delays={delays}
        onDelaysChange={setDelays}
        onReset={() => setDelays({})}
        shortfall={shortfall}
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Cash events</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecast.events.map((event) => {
                const isIn = event.direction === "in";
                return (
                  <tr key={`${event.sourceId}-${event.date}`} className="text-slate-700">
                    <td className="px-5 py-3">{formatDate(event.date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{event.description}</td>
                    <td className="px-5 py-3">{isIn ? "Invoice payment" : "Bill"}</td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${isIn ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {isIn ? "+" : "−"}
                      {formatINR(event.amountINR)}
                    </td>
                  </tr>
                );
              })}
              {forecast.events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                    No cash events in this horizon.
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
