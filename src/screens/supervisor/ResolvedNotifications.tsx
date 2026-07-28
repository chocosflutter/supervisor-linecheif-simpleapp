import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { History, Check, Clock, ArrowLeft, ClipboardCheck } from "lucide-react";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import GlassCard from "@/components/GlassCard";
import { CATEGORY_META, relTime, useEntrySummary } from "./Notifications";

export default function ResolvedNotifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const alerts = useApp((s) => s.alerts);
  const getEntrySummary = useEntrySummary();

  const myResolved = useMemo(
    () =>
      alerts
        .filter((a) => a.status === "resolved" && user.lineIds.includes(a.lineId))
        .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "")),
    [alerts, user.lineIds]
  );

  return (
    <div className="space-y-4 animate-rise pb-24">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/notifications")}
          className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink transition mb-1"
        >
          <ArrowLeft size={14} /> {t("notifications.title")}
        </button>
        <h1 className="text-xl font-bold text-ink flex items-center gap-2">
          <History size={20} className="text-brand" /> {t("notifications.resolvedLog")}
        </h1>
        <p className="text-[11px] text-ink-muted mt-0.5">{t("notifications.resolvedSubtitle")}</p>
      </div>

      {myResolved.length === 0 ? (
        <GlassCard level={2} className="p-8 text-center">
          <ClipboardCheck size={28} className="mx-auto text-ink-muted mb-2" />
          <p className="text-sm font-semibold text-ink">{t("notifications.noResolved")}</p>
          <p className="text-xs text-ink-muted mt-1">{t("notifications.noResolvedHint")}</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {myResolved.map((alert) => {
            const meta = CATEGORY_META[alert.category];
            const Icon = meta.icon;
            const summary = getEntrySummary(alert);
            return (
              <GlassCard key={alert.id} level={2} className="p-3 border border-slate-100 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className={`shrink-0 mt-0.5 h-8 w-8 grid place-items-center rounded-full bg-slate-100 ${meta.accent}`}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-ink">{lineName(alert.lineId, lang)}</span>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      <span className="font-semibold text-ink-muted">{t("notifications.ieFlag")}:</span> "{alert.note}"
                    </p>
                  </div>
                </div>

                {summary && (
                  <div className="bg-slate-50 rounded-xl px-2.5 py-1.5 text-[11px] text-ink font-medium">
                    {summary}
                  </div>
                )}

                {/* Resolution block */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                    <Check size={13} /> {t("notifications.resolvedBy", { name: alert.resolvedBy })}
                  </span>
                  {alert.resolutionNote && (
                    <p className="text-[11px] text-emerald-900 font-medium pl-4">"{alert.resolutionNote}"</p>
                  )}
                  {alert.resolvedAt && (
                    <span className="text-[10px] text-emerald-700 flex items-center gap-1 pl-4">
                      <Clock size={10} /> {relTime(alert.resolvedAt, lang)}
                    </span>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
