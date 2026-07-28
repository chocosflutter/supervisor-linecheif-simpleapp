import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import { useApp } from "@/store/appStore";
import GlassCard from "@/components/GlassCard";

export default function Settings() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user)!;
  const lite = useApp((s) => s.lite);
  const toggleLite = useApp((s) => s.toggleLite);
  const logout = useApp((s) => s.logout);

  return (
    <div className="space-y-4 animate-rise">
      <h1 className="text-2xl font-bold text-ink">{t("common.settings")}</h1>

      {/* User Profile Card */}
      <GlassCard level={2} className="p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t(`roles.${user.role}`)} Profile
        </p>
        <p className="text-lg font-bold text-ink">{user.name}</p>
      </GlassCard>

      {/* Lite Mode Preference */}
      <GlassCard level={2} className="p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-ink text-sm">{t("common.liteMode")}</p>
          <p className="text-xs text-ink-muted">Optimized layout & graphics for low-end mobile devices</p>
        </div>
        <button
          onClick={toggleLite}
          className={clsx(
            "h-7 w-12 rounded-full transition relative",
            lite ? "bg-brand" : "bg-ink/20"
          )}
        >
          <span
            className={clsx(
              "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all shadow-sm",
              lite ? "left-[1.625rem]" : "left-0.5"
            )}
          />
        </button>
      </GlassCard>

      {/* Logout Card */}
      <GlassCard level={2} className="p-4 pt-2">
        <button
          onClick={logout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-sm cursor-pointer"
        >
          <LogOut size={18} />
          <span>{t("common.logout") || "Log Out"}</span>
        </button>
      </GlassCard>
    </div>
  );
}
