import type { InvoiceStatus } from "../types";

// Duplicated from Overview.tsx by design: Overview stays untouched.
const STATUS_STYLES: Record<InvoiceStatus, { text: string; dot: string }> = {
  draft: { text: "text-slate-600", dot: "bg-slate-400" },
  sent: { text: "text-blue-700", dot: "bg-blue-500" },
  overdue: { text: "text-red-700", dot: "bg-red-500" },
  paid: { text: "text-emerald-700", dot: "bg-emerald-500" },
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
};

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_STYLES[status].text}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status].dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
