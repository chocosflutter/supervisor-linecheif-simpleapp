import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function AppShell() {
  return (
    <div className="min-h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
