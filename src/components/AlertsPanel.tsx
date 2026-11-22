import type { Alert, AlertPriority } from "../utils/alerts";

interface AlertsPanelProps {
  alerts: Alert[];
  onOpenInvoice: (invoiceId: string) => void;
  onOpenForecast: () => void;
}

const PRIORITY_LABEL: Record<AlertPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_CLASS: Record<AlertPriority, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

export default function AlertsPanel({ alerts, onOpenInvoice, onOpenForecast }: AlertsPanelProps) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {alerts.length}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-6 text-sm">
          <p className="font-medium text-slate-900">No alerts right now.</p>
          <p className="mt-1 text-slate-500">
            Checked: overdue invoices, invoices due within 14 days, bills due within 30 days, and the cash forecast
            for the next 90 days.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((alert) => (
            <li key={alert.id} className="min-w-0 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_CLASS[alert.priority]}`}
                >
                  {PRIORITY_LABEL[alert.priority]}
                </span>
                <h3 className="min-w-0 break-words text-sm font-semibold text-slate-900">{alert.title}</h3>
              </div>
              <p className="mt-2 break-words text-sm text-slate-700">{alert.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (alert.action.kind === "invoice") {
                      onOpenInvoice(alert.action.invoiceId);
                    } else {
                      onOpenForecast();
                    }
                  }}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {alert.actionLabel}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
