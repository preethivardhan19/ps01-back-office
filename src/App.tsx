import { useEffect, useState } from "react";
import ReminderDrawer from "./components/ReminderDrawer";
import Sidebar, { type ScreenId } from "./components/Sidebar";
import { AppStateProvider, useAppState } from "./state/AppState";
import Bills from "./screens/Bills";
import CashForecast from "./screens/CashForecast";
import Invoices from "./screens/Invoices";
import Overview from "./screens/Overview";

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const { state, resetDemo } = useAppState();
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | null>(null);

  // On demo reset, return to Overview and close any open reminder drawer.
  // Setting these to their current values on first mount is a no-op.
  useEffect(() => {
    setScreen("overview");
    setReminderInvoiceId(null);
  }, [state.resetCount]);

  return (
    <div className="flex min-h-screen bg-[#faf9f6]">
      <Sidebar active={screen} onNavigate={setScreen} onResetDemo={resetDemo} />
      <main className="flex-1 min-w-0 px-4 pb-8 pt-20 md:p-8">
        {/* Keyed by resetCount so local screen state (filters, What-If inputs, etc.) remounts on reset. */}
        <div key={state.resetCount}>
          {renderScreen(screen, setReminderInvoiceId, setScreen)}
        </div>
      </main>
      <ReminderDrawer invoiceId={reminderInvoiceId} onClose={() => setReminderInvoiceId(null)} />
    </div>
  );
}

function renderScreen(
  screen: ScreenId,
  onOpenInvoice: (invoiceId: string) => void,
  navigate: (screen: ScreenId) => void,
) {
  switch (screen) {
    case "overview":
      return <Overview onOpenInvoice={onOpenInvoice} onOpenForecast={() => navigate("forecast")} />;
    case "invoices":
      return <Invoices />;
    case "forecast":
      return <CashForecast />;
    case "bills":
      return <Bills />;
  }
}
