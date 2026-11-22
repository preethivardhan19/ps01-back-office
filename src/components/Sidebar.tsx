import { useState } from "react";

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
  onResetDemo?: () => void;
}

const MOBILE_MENU_ID = "mobile-nav-menu";

const RESET_CONFIRM_MESSAGE =
  "Reset all demo data to the original seed values? Bills and payments you added will be removed.";

function ResetDemoButton({ onResetDemo, className }: { onResetDemo?: () => void; className: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.confirm(RESET_CONFIRM_MESSAGE)) {
          onResetDemo?.();
        }
      }}
    >
      Reset Demo Data
    </button>
  );
}

export default function Sidebar({ active, onNavigate, onResetDemo }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Back Office</p>
            <p className="text-xs text-slate-500">PS-01 · INR</p>
          </div>
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <nav
            id={MOBILE_MENU_ID}
            className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-slate-200 bg-white px-3 pb-3"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMenuOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "flex min-h-11 items-center rounded-md bg-indigo-600 px-3 py-3 text-left text-sm font-medium text-white"
                      : "flex min-h-11 items-center rounded-md px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  }
                >
                  {item.label}
                </button>
              );
            })}
            <ResetDemoButton
              onResetDemo={onResetDemo}
              className="mt-2 min-h-11 px-3 py-3 text-left text-xs text-slate-500 underline-offset-2 hover:underline"
            />
          </nav>
        )}
      </div>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
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
                    ? "rounded-md bg-indigo-600 px-3 py-2 text-left text-sm font-medium text-white"
                    : "rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                }
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto px-3 pb-6 pt-6">
          <ResetDemoButton
            onResetDemo={onResetDemo}
            className="px-3 py-2 text-left text-xs text-slate-500 underline-offset-2 hover:underline"
          />
        </div>
      </aside>
    </>
  );
}
