import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  Layers,
  AlertTriangle,
  Users,
  ShieldAlert,
  Clock,
  ChevronRight,
  Check,
  History,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import GlassCard from "@/components/GlassCard";
import type { IeAlert } from "@/types";

/* ------------------------------------------------------------------ */
/*  Category display metadata (icon, label, colour, target screen)     */
/* ------------------------------------------------------------------ */
export const CATEGORY_META: Record<
  IeAlert["category"],
  { icon: typeof Layers; label: string; route: string; accent: string }
> = {
  production: { icon: Layers, label: "Production Entry", route: "/production", accent: "text-brand" },
  defects: { icon: AlertTriangle, label: "Defects Audit", route: "/production", accent: "text-state-danger" },
  attendance: { icon: Users, label: "Attendance", route: "/attendance", accent: "text-emerald-600" },
  style: { icon: ShieldAlert, label: "Style Setup", route: "/home", accent: "text-amber-600" },
};

export function relTime(iso: string, lang: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return lang === "bn" ? "এইমাত্র" : "just now";
  if (diffMin < 60) return `${diffMin}${lang === "bn" ? " মিঃ আগে" : "m ago"}`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}${lang === "bn" ? " ঘঃ আগে" : "h ago"}`;
  return new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric" });
}

/* Resolve a short human description of the flagged entry from its ref. */
export function useEntrySummary() {
  const production = useApp((s) => s.production);
  const attendance = useApp((s) => s.attendance);
  const lineStyles = useApp((s) => s.lineStyles);
  const styles = useApp((s) => s.styles);

  return (alert: IeAlert): string | null => {
    const ref = alert.entryRef ?? "";
    if (ref.startsWith("prod-") || ref.startsWith("def-")) {
      const id = ref.replace(/^(prod|def)-/, "");
      const p = production.find((x) => x.id === id);
      if (!p) return null;
      const inspected = p.goodQty + p.defectivePcs;
      if (ref.startsWith("def-")) {
        return `${p.hourSlot} · ${p.defectivePcs} defective / ${inspected} inspected · ${p.totalDefects} defects`;
      }
      return `${p.hourSlot} · ${p.goodQty} good / ${inspected} inspected`;
    }
    if (ref.startsWith("att-")) {
      const att = attendance.find((a) => `att-${a.lineId}-${a.date}` === ref);
      if (!att) return null;
      return `${att.operators} Op · ${att.helpers} Hlp · ${att.pressmen} Prs · ${att.checkers} Chk`;
    }
    if (alert.category === "style") {
      const ls = lineStyles.find((x) => x.lineId === alert.lineId && !x.unloadedAt);
      const st = styles.find((s) => s.id === ls?.styleId);
      return st ? `Style ${st.code}` : null;
    }
    return null;
  };
}

/* ================================================================== */
/*                     Notification Card (Incoming)                    */
/* ================================================================== */
function NotificationCard({ alert }: { alert: IeAlert }) {
  const navigate = useNavigate();
  const lang = useApp((s) => s.lang);
  const resolveAlert = useApp((s) => s.resolveAlert);
  const getEntrySummary = useEntrySummary();

  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");

  const meta = CATEGORY_META[alert.category];
  const Icon = meta.icon;
  const summary = getEntrySummary(alert);

  // Build a deep link that opens the exact flagged entry in correction mode.
  const correctionHref = (): string => {
    const ref = alert.entryRef ?? "";
    if (ref.startsWith("prod-") || ref.startsWith("def-")) {
      const id = ref.replace(/^(prod|def)-/, "");
      return `/production?correctId=${encodeURIComponent(id)}&alert=${encodeURIComponent(alert.id)}`;
    }
    if (ref.startsWith("att-")) {
      const date = ref.slice(`att-${alert.lineId}-`.length);
      return `/attendance?correctLine=${encodeURIComponent(alert.lineId)}&correctDate=${encodeURIComponent(
        date
      )}&alert=${encodeURIComponent(alert.id)}`;
    }
    return meta.route;
  };
  const canCorrect = alert.category !== "style";

  return (
    <GlassCard level={2} className="p-3 border border-slate-100 space-y-2">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-2.5 text-left"
      >
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
          <p className="text-[11px] text-ink font-medium mt-0.5 line-clamp-2">"{alert.note}"</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-muted">
            <span>{alert.raisedBy}</span>
            <span className="flex items-center gap-0.5">
              <Clock size={10} /> {relTime(alert.raisedAt, lang)}
            </span>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`shrink-0 mt-1 text-ink-muted transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expanded action panel */}
      {expanded && (
        <div className="space-y-2.5 pt-1 animate-fadeIn border-t border-slate-100">
          {summary && (
            <div className="bg-slate-50 rounded-xl p-2.5 mt-2">
              <span className="text-[9px] uppercase font-semibold text-ink-muted block">Flagged Entry</span>
              <span className="text-xs font-semibold text-ink">{summary}</span>
            </div>
          )}

          {canCorrect ? (
            <>
              <button
                onClick={() => navigate(correctionHref())}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-600 px-3 py-2.5 rounded-xl transition active:scale-[0.98] shadow-sm"
              >
                <ArrowRight size={14} /> Correct this {meta.label}
              </button>
              <p className="text-[10px] text-ink-muted text-center">
                Opens only the flagged entry. Saving your fix resolves this alert and updates the IE.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] uppercase font-semibold text-ink-muted block mb-1">
                  What did you change / correct?
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe the action taken for the IE"
                  className="w-full bg-white border border-brand/20 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
                />
              </div>
              <button
                disabled={!note.trim()}
                onClick={() => resolveAlert(alert.id, note)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold bg-state-success text-white px-3 py-2 rounded-xl transition active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={14} /> Mark Resolved & Notify IE
              </button>
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}

/* ================================================================== */
/*                     Notifications Page (Incoming)                   */
/* ================================================================== */
export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useApp((s) => s.user)!;
  const alerts = useApp((s) => s.alerts);

  const myOpen = useMemo(
    () =>
      alerts
        .filter((a) => a.status === "open" && user.lineIds.includes(a.lineId))
        .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)),
    [alerts, user.lineIds]
  );

  const resolvedCount = useMemo(
    () => alerts.filter((a) => a.status === "resolved" && user.lineIds.includes(a.lineId)).length,
    [alerts, user.lineIds]
  );

  return (
    <div className="space-y-4 animate-rise pb-24">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          {user.name} · {t("roles.supervisor")}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Bell size={20} className="text-brand" /> {t("notifications.title")}
          </h1>
          <span className="text-xs font-bold text-state-danger bg-state-danger/10 border border-state-danger/20 px-3 py-1 rounded-full">
            {myOpen.length} {t("notifications.new")}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted mt-0.5">{t("notifications.subtitle")}</p>
      </div>

      {/* Resolved log link */}
      <button
        onClick={() => navigate("/notifications/resolved")}
        className="w-full flex items-center justify-between glass-1 rounded-2xl px-4 py-3 shadow-sm hover:bg-slate-50 transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <History size={16} className="text-brand" /> {t("notifications.resolvedLog")}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          {resolvedCount} {t("notifications.resolved")}
          <ChevronRight size={16} />
        </span>
      </button>

      {/* Incoming list */}
      {myOpen.length === 0 ? (
        <GlassCard level={2} className="p-8 text-center">
          <BellOff size={28} className="mx-auto text-ink-muted mb-2" />
          <p className="text-sm font-semibold text-ink">{t("notifications.empty")}</p>
          <p className="text-xs text-ink-muted mt-1">{t("notifications.emptyHint")}</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {myOpen.map((alert) => (
            <NotificationCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
