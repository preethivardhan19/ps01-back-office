import { useState } from "react";
import ReminderDrawer from "./components/ReminderDrawer";
import Sidebar, { type ScreenId } from "./components/Sidebar";
import CashForecast from "./screens/CashForecast";
import Invoices from "./screens/Invoices";
import Overview from "./screens/Overview";
import Placeholder from "./screens/Placeholder";

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={screen} onNavigate={setScreen} />
      <main className="flex-1 min-w-0 px-4 pb-8 pt-20 md:p-8">{renderScreen(screen, setReminderInvoiceId, setScreen)}</main>
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
      return <Placeholder title="Bills" />;
  }
}
