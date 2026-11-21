export type ScreenId = "overview" | "invoices" | "forecast" | "bills";

interface NavItem {
  id: ScreenId;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "forecast", label: "Cash Forecast" },
  { id: "bills", label: "Bills" },
];

interface SidebarProps {
  active: ScreenId;
  onNavigate: (id: ScreenId) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-6 py-6">
        <p className="text-sm font-semibold text-slate-900">Back Office</p>
        <p className="text-xs text-slate-500">PS-01 · INR</p>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
                  : "rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              }
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
