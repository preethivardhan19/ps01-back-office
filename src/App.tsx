import { useState } from "react";
import Sidebar, { type ScreenId } from "./components/Sidebar";
import Invoices from "./screens/Invoices";
import Overview from "./screens/Overview";
import Placeholder from "./screens/Placeholder";

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("overview");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={screen} onNavigate={setScreen} />
      <main className="flex-1 p-8">{renderScreen(screen)}</main>
    </div>
  );
}

function renderScreen(screen: ScreenId) {
  switch (screen) {
    case "overview":
      return <Overview />;
    case "invoices":
      return <Invoices />;
    case "forecast":
      return <Placeholder title="Cash Forecast" />;
    case "bills":
      return <Placeholder title="Bills" />;
  }
}
