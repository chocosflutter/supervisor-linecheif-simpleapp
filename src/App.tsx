import { lazy, Suspense, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useApp, SUPABASE_MODE } from "@/store/appStore";
import AppShell from "@/components/AppShell";
import Login from "@/screens/Login";
import RoleHome from "@/screens/RoleHome";

// Lazy-loaded routes for bundle split (Phase 8).
const SupervisorAttendance = lazy(() => import("@/screens/supervisor/SupervisorAttendance"));
const HourlyEntry = lazy(() => import("@/screens/supervisor/HourlyEntry"));
const LoadStyle = lazy(() => import("@/screens/ie/LoadStyle"));
const IeSetup = lazy(() => import("@/screens/ie/IeSetup"));
const IeAuditView = lazy(() => import("@/screens/ie/IeAuditView"));
const PerformanceExplorer = lazy(() => import("@/screens/shared/PerformanceExplorer"));
const Settings = lazy(() => import("@/screens/shared/Settings"));
const Notifications = lazy(() => import("@/screens/supervisor/Notifications"));
const ResolvedNotifications = lazy(() => import("@/screens/supervisor/ResolvedNotifications"));
const DowntimeReasons = lazy(() => import("@/screens/ie/DowntimeReasons"));
const SuperAdminHome = lazy(() => import("@/screens/superadmin/SuperAdminHome"));
const FactoryUsers = lazy(() => import("@/screens/superadmin/FactoryUsers"));

export default function App() {
  const user = useApp((s) => s.user);
  const lite = useApp((s) => s.lite);
  const authReady = useApp((s) => s.authReady);
  const hydrated = useApp((s) => s.hydrated);
  const bootstrapAuth = useApp((s) => s.bootstrapAuth);
  const setOnline = useApp((s) => s.setOnline);
  const nav = useNavigate();
  const didRedirect = useRef(false);

  // On session restore or login, redirect to /home once hydrated.
  useEffect(() => {
    if (user && hydrated && !didRedirect.current) {
      didRedirect.current = true;
      nav("/home", { replace: true });
    }
    if (!user) didRedirect.current = false;
  }, [user, hydrated, nav]);

  useEffect(() => {
    if (SUPABASE_MODE) bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);

  useEffect(() => {
    document.documentElement.classList.toggle("lite", lite);
  }, [lite]);

  if (!authReady || (user && !hydrated)) {
    return (
      <div className="min-h-full grid place-items-center p-6 text-ink-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Suspense fallback={<div className="min-h-full grid place-items-center p-6 text-ink-muted text-sm">Loading…</div>}>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/home" element={<RoleHome />} />
        <Route path="/attendance" element={<SupervisorAttendance />} />
        <Route path="/production" element={<HourlyEntry />} />
        <Route path="/load" element={<LoadStyle />} />
        <Route path="/setup" element={<IeSetup />} />
        <Route path="/downtime-reasons" element={<DowntimeReasons />} />
        <Route path="/audit" element={<IeAuditView />} />
        <Route path="/factories" element={<SuperAdminHome />} />
        <Route path="/factory-users" element={<FactoryUsers />} />
        <Route path="/performance" element={<PerformanceExplorer />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/resolved" element={<ResolvedNotifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
