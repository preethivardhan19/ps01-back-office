interface PersistenceNoticeProps {
  message: string;
  onDismiss: () => void;
}

/** Restrained, dismissible notice about browser storage problems. Plain text only; no technical detail. */
export default function PersistenceNotice({ message, onDismiss }: PersistenceNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-start justify-between gap-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="min-w-0">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss storage notice"
        className="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-900 underline hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
      >
        Dismiss
      </button>
    </div>
  );
}
