import type { InvoiceStatus } from "../types";

// Duplicated from Overview.tsx by design: Overview stays untouched.
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

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
