import { ArrowLeft, Bell, ShieldCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import OnlineBadge from "./OnlineBadge";
import LanguageToggle from "./LanguageToggle";

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const user = useApp((s) => s.user);
  const alerts = useApp((s) => s.alerts);
  const superAdmin = useApp((s) => s.superAdmin);
  const returnToSuperAdmin = useApp((s) => s.returnToSuperAdmin);
  const impersonating = Boolean(superAdmin) && user?.role !== "super_admin";

  // Home is the first/landing screen for every role — never go back past it.
  const rootPaths = ["/login", "/home"];
  const canGoBack = !rootPaths.includes(location.pathname);

  // Supervisors receive audit alerts raised by the IE for the lines they own.
  const isSupervisor = user?.role === "supervisor";
  const openCount = isSupervisor
    ? alerts.filter((a) => a.status === "open" && user!.lineIds.includes(a.lineId)).length
    : 0;

  return (
    <header
      className="glass-solid bg-white/95 backdrop-blur-md sticky top-0 z-[80] flex items-center gap-2 px-3 py-2.5 shadow-sm border-b border-slate-200/60"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <img src="/logo.png" alt="RBC" className="h-7 w-auto cursor-pointer" onClick={() => navigate("/")} />

      {impersonating && (
        <button
          onClick={() => {
            returnToSuperAdmin();
            navigate("/factories", { replace: true });
          }}
          className="flex items-center gap-1.5 text-[11px] font-bold text-brand bg-brand-100 border border-brand/30 px-2.5 py-1 rounded-full hover:bg-brand hover:text-white transition active:scale-95"
          title={t("superadmin.returnToAdmin")}
        >
          <ShieldCheck size={13} />
          <span className="hidden sm:inline">{t("superadmin.returnToAdmin")}</span>
          <span className="sm:hidden">{t("superadmin.actingBanner", { role: user ? t(`roles.${user.role}`) : "" })}</span>
        </button>
      )}

      <div className="flex-1" />
      <OnlineBadge />
      <LanguageToggle />

      {isSupervisor && (
        <button
          onClick={() => navigate("/notifications")}
          className="relative h-9 w-9 grid place-items-center rounded-full glass-1 text-ink hover:bg-slate-100 transition active:scale-95"
          aria-label="Notifications"
          title="IE Alerts"
        >
          <Bell size={18} className="text-brand-700" />
          {openCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-state-danger text-white text-[10px] font-bold shadow-sm ring-2 ring-white animate-fadeIn">
              {openCount > 9 ? "9+" : openCount}
            </span>
          )}
        </button>
      )}

      {canGoBack && (
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 grid place-items-center rounded-full glass-1 text-ink hover:bg-slate-100 transition active:scale-95"
          aria-label="Back"
          title="Go Back"
        >
          <ArrowLeft size={18} className="text-brand-700 font-bold" />
        </button>
      )}
    </header>
  );
}
