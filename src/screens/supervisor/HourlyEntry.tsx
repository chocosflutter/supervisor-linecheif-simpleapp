import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, History, ArrowLeft, Search, ShieldCheck, X, Clock, Calendar, Play, XCircle, ShieldAlert } from "lucide-react";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import { TODAY } from "@/lib/today";
import { num } from "@/lib/format";
import Stepper from "@/components/Stepper";
import GlassCard from "@/components/GlassCard";
import DowntimeModal from "@/components/DowntimeModal";
import type { IeAlert, ProductionHour } from "@/types";

/* ================================================================== */
/*   Focused correction view — edits ONLY the IE-flagged hour entry    */
/* ================================================================== */
function ProductionCorrection({ entry, alert }: { entry: ProductionHour; alert?: IeAlert | null }) {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const navigate = useNavigate();
  const update = useApp((s) => s.updateProductionHour);
  const resolveAlert = useApp((s) => s.resolveAlert);
  const styles = useApp((s) => s.styles);

  const oldInspected = entry.goodQty + entry.defectivePcs;
  const [inspected, setInspected] = useState(oldInspected);
  const [defective, setDefective] = useState(entry.defectivePcs);
  const [defects, setDefects] = useState(entry.totalDefects);
  const [remark, setRemark] = useState("");
  const [saved, setSaved] = useState(false);

  const passedQty = Math.max(0, inspected - defective);
  const defectivePct = inspected === 0 ? "0.0" : ((defective / inspected) * 100).toFixed(1);
  const dhu = inspected === 0 ? "0.0" : ((defects * 100) / inspected).toFixed(1);
  const style = styles.find((s) => s.id === entry.styleId);

  const save = () => {
    update(entry.id, { goodQty: passedQty, defectivePcs: defective, totalDefects: defects });

    // Auto-resolve the alert with an exact record of what changed, so the IE
    // sees the correction on their audit screen.
    if (alert) {
      const changes: string[] = [];
      if (inspected !== oldInspected) changes.push(`inspected ${oldInspected}→${inspected}`);
      if (defective !== entry.defectivePcs) changes.push(`defective ${entry.defectivePcs}→${defective}`);
      if (defects !== entry.totalDefects) changes.push(`defects ${entry.totalDefects}→${defects}`);
      const diff = changes.length
        ? `Slot ${entry.hourSlot}: ${changes.join(", ")}`
        : `Slot ${entry.hourSlot}: reviewed, no change needed`;
      const note = remark.trim() ? `${diff} — Remark: ${remark.trim()}` : diff;
      resolveAlert(alert.id, note);
    }

    setSaved(true);
    // Replace so the browser/Top-bar back button cannot return to this
    // (now-resolved) correction screen.
    setTimeout(() => navigate("/notifications", { replace: true }), 1100);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Back */}
      <button
        onClick={() => navigate("/notifications", { replace: true })}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand glass-1 px-3 py-1.5 rounded-full hover:bg-brand/10 transition active:scale-95 cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>{t("notifications.title")}</span>
      </button>

      <div>
        <h1 className="text-xl font-bold text-ink">Correct Production Entry</h1>
        <p className="text-[11px] text-ink-muted mt-0.5">
          {lineName(entry.lineId, lang)} · Slot {entry.hourSlot} · {entry.date}
        </p>
      </div>

      {/* IE instruction banner */}
      {alert && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
              {t("notifications.ieFlag")} · {alert.raisedBy}
            </span>
            <p className="text-xs text-amber-900 font-medium">"{alert.note}"</p>
          </div>
        </div>
      )}

      {/* Focused single-entry editor (highlighted) */}
      <GlassCard level="solid" hairline className="p-4 space-y-4 ring-2 ring-brand/40 border border-brand/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-brand bg-brand-100/60 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Clock size={13} /> {entry.hourSlot}
          </span>
          {style && (
            <span className="text-[11px] font-semibold text-ink-muted">
              {style.code} · {style.name}
            </span>
          )}
        </div>

        <div className="glass-solid rounded-2xl px-4 divide-y divide-ink/5 border border-slate-100">
          <Stepper label={t("production.inspectedPcs")} value={inspected} onChange={(v) => setInspected(Math.max(0, v))} />
          <Stepper label={t("production.defectivePcs")} value={defective} onChange={(v) => setDefective(Math.max(0, Math.min(inspected, v)))} />
          <Stepper label={t("production.totalDefects")} value={defects} onChange={(v) => setDefects(Math.max(0, v))} />
        </div>

        <div className="bg-brand-100/40 border border-brand/20 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-state-success" />
              {t("production.passedPcs")}
            </span>
            <span className="text-lg font-bold text-brand">{num(passedQty)} pcs</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand/10">
            <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
              <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">{t("production.defectivePct")}</span>
              <span className="text-sm font-extrabold text-ink">{defectivePct}%</span>
            </div>
            <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
              <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">{t("production.dhu")}</span>
              <span className="text-sm font-extrabold text-ink">{dhu}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-ink-muted block mb-1">
            {t("notifications.remark")}
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={t("notifications.remarkPlaceholder")}
            className="w-full bg-white border border-brand/20 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
          />
        </div>

        <button
          onClick={save}
          className={`w-full font-semibold rounded-2xl py-3.5 transition active:scale-[0.98] shadow-glass flex items-center justify-center gap-2 ${
            saved ? "bg-state-success text-white" : "bg-brand text-white"
          }`}
        >
          {saved ? (
            <>
              <Check size={20} /> {t("attendance.saveCorrection")} ✓
            </>
          ) : (
            t("attendance.saveCorrection")
          )}
        </button>
      </GlassCard>

      <p className="text-[11px] text-ink-muted text-center px-4">
        Only this flagged hour can be edited here. Other entries stay locked.
      </p>
    </div>
  );
}

interface SlotInfo {
  slot: string;
  isFullBreak?: boolean;
  breakName?: string;
  breakMins?: number;
}

function buildSlots(shift: any, lineUnitId?: string, lineFloorId?: string): SlotInfo[] {
  const h0 = parseInt(shift.start.slice(0, 2), 10) || 8;
  const h1 = parseInt(shift.end.slice(0, 2), 10) || 17;
  const slots: SlotInfo[] = [];

  for (let h = h0; h < h1; h++) {
    const slotStr = `${String(h).padStart(2, "0")}:00-${String(h + 1).padStart(2, "0")}:00`;

    const matchingBreak = (shift.breaks || []).find((b: any) => {
      const matchesUnit = !b.unitId || b.unitId === "all" || b.unitId === lineUnitId;
      const matchesFloor = !b.floorId || b.floorId === "all" || b.floorId === lineFloorId;
      if (!matchesUnit || !matchesFloor) return false;

      const [bH] = b.startTime.split(":").map(Number);
      return bH === h;
    });

    if (matchingBreak && matchingBreak.durationMinutes >= 60) {
      slots.push({ slot: slotStr, isFullBreak: true, breakName: matchingBreak.name, breakMins: 60 });
    } else if (matchingBreak) {
      slots.push({ slot: slotStr, isFullBreak: false, breakName: matchingBreak.name, breakMins: matchingBreak.durationMinutes });
    } else {
      slots.push({ slot: slotStr, isFullBreak: false });
    }
  }

  return slots;
}

interface DaySummary {
  date: string;
  hours: ProductionHour[];
  totalGood: number;
  totalDefective: number;
  totalDefects: number;
  totalInspected: number;
  defRate: string;
  dhu: string;
  hoursCount: number;
}

export default function HourlyEntry() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const shift = useApp((s) => s.settings.shift);
  const production = useApp((s) => s.production);
  const alerts = useApp((s) => s.alerts);
  const add = useApp((s) => s.addProductionHour);
  const lineStylesState = useApp((s) => s.lineStyles);
  const styles = useApp((s) => s.styles);
  const endRunningStyle = useApp((s) => s.endRunningStyle);
  const startQueuedStyle = useApp((s) => s.startQueuedStyle);

  const [searchParams] = useSearchParams();

  const [lineId, setLineId] = useState(user.lineIds[0]);
  const [subView, setSubView] = useState<"entry" | "history">("entry");
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "today" | "past">("all");
  const [activeBreakup, setActiveBreakup] = useState<ProductionHour | null>(null);
  const [activeDayBreakdown, setActiveDayBreakdown] = useState<DaySummary | null>(null);
  const [showEndStyleModal, setShowEndStyleModal] = useState(false);
  const [showDowntime, setShowDowntime] = useState(false);

  const lines = useApp((s) => s.lines);
  const floors = useApp((s) => s.floors);

  const currentLine = lines.find((l) => l.id === lineId);
  const currentFloor = floors.find((f) => f.id === currentLine?.floorId);
  const lineUnitId = currentFloor?.unitId;
  const lineFloorId = currentLine?.floorId;

  // All shift slots dynamically constructed from IE Setup
  const allSlotInfos = useMemo(
    () => buildSlots(shift, lineUnitId, lineFloorId),
    [shift, lineUnitId, lineFloorId]
  );
  const allSlots = useMemo(() => allSlotInfos.map((x) => x.slot), [allSlotInfos]);

  // Requirement 2: Only show hours till which has elapsed
  const currentHour = new Date().getHours();
  const visibleSlots = useMemo(() => {
    const elapsed = allSlots.filter((s) => {
      const slotStartHour = parseInt(s.slice(0, 2), 10);
      return slotStartHour <= currentHour;
    });
    return elapsed.length > 0 ? elapsed : allSlots.slice(0, 1);
  }, [allSlots, currentHour]);

  // Running hour slot matching current real-time hour
  const runningSlot = useMemo(() => {
    const currStr = `${String(currentHour).padStart(2, "0")}:00`;
    const found = visibleSlots.find((s) => s.startsWith(currStr));
    if (found) return found;
    return visibleSlots[visibleSlots.length - 1];
  }, [visibleSlots, currentHour]);

  const [slot, setSlot] = useState(runningSlot);

  // Automatically sync default slot to running hour when line changes or initial load
  useEffect(() => {
    setSlot(runningSlot);
  }, [lineId, runningSlot]);

  const entered = production.filter((p) => p.lineId === lineId && p.date === TODAY);

  // Inputs: Total Inspected, Defective Pcs, Total Defects
  const [inspected, setInspected] = useState(124);
  const [defective, setDefective] = useState(4);
  const [defects, setDefects] = useState(6);
  const [flash, setFlash] = useState(false);

  // Live Automatic Calculations
  const passedQty = Math.max(0, inspected - defective);
  const defectivePct = inspected === 0 ? "0.0" : ((defective / inspected) * 100).toFixed(1);
  const dhu = inspected === 0 ? "0.0" : ((defects * 100) / inspected).toFixed(1);

  const save = () => {
    const ls = lineStylesState.find((x) => x.lineId === lineId && !x.unloadedAt);
    add({
      id: `${lineId}-${slot}-${Date.now()}`,
      lineId,
      styleId: ls?.styleId ?? "s1",
      date: TODAY,
      hourSlot: slot,
      goodQty: passedQty,
      defectivePcs: defective,
      totalDefects: defects,
      enteredAt: new Date().toISOString(),
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  };

  // Day-Wise Grouping for Production History
  const historyDays = useMemo(() => {
    const lineRecords = production.filter((p) => p.lineId === lineId);
    const map = new Map<string, ProductionHour[]>();

    for (const item of lineRecords) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }

    const days: DaySummary[] = Array.from(map.entries()).map(([date, hours]) => {
      const totalGood = hours.reduce((sum, h) => sum + h.goodQty, 0);
      const totalDefective = hours.reduce((sum, h) => sum + h.defectivePcs, 0);
      const totalDefects = hours.reduce((sum, h) => sum + h.totalDefects, 0);
      const totalInspected = totalGood + totalDefective;
      const defRate = totalInspected === 0 ? "0.0" : ((totalDefective / totalInspected) * 100).toFixed(1);
      const calcDhu = totalInspected === 0 ? "0.0" : ((totalDefects * 100) / totalInspected).toFixed(1);

      return {
        date,
        hours: hours.sort((a, b) => a.hourSlot.localeCompare(b.hourSlot)),
        totalGood,
        totalDefective,
        totalDefects,
        totalInspected,
        defRate,
        dhu: calcDhu,
        hoursCount: hours.length,
      };
    });

    let filtered = days;
    if (historyFilter === "today") {
      filtered = filtered.filter((d) => d.date === TODAY);
    } else if (historyFilter === "past") {
      filtered = filtered.filter((d) => d.date !== TODAY);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((d) => d.date.includes(q));
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [production, lineId, historyFilter, search]);

  const currentLineLabel = lineName(lineId, lang);

  // IE-driven correction: open only the flagged hour entry, everything else locked.
  const correctId = searchParams.get("correctId");
  const correctAlertId = searchParams.get("alert");
  const correctionEntry = correctId ? production.find((p) => p.id === correctId) : null;
  const correctionAlert = correctAlertId ? alerts.find((a) => a.id === correctAlertId) : null;
  if (correctionEntry) {
    return <ProductionCorrection entry={correctionEntry} alert={correctionAlert} />;
  }

  // Render Full Production History Screen (Day-Wise View)
  if (subView === "history") {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Header Bar with Back Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSubView("entry")}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand glass-1 px-3 py-1.5 rounded-full hover:bg-brand/10 transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>{t("common.back")}</span>
          </button>
          <h1 className="text-lg font-bold text-ink">{t("production.productionHistory")}</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by date (YYYY-MM-DD)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-ink focus:outline-none focus:border-brand shadow-sm"
          />
        </div>

        {/* History Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(["all", "today", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setHistoryFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                historyFilter === f
                  ? "bg-brand text-white shadow-sm"
                  : "glass-1 text-ink-muted hover:text-ink"
              }`}
            >
              {f === "all" ? "All History" : f === "today" ? "Today's Entries" : "Past Days"}
            </button>
          ))}
        </div>

        {/* Day-Wise History Cards */}
        <div className="space-y-3">
          {historyDays.length === 0 ? (
            <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs">
              No production records found for {currentLineLabel}.
            </GlassCard>
          ) : (
            historyDays.map((d) => {
              const isToday = d.date === TODAY;
              return (
                <GlassCard
                  key={d.date}
                  level={2}
                  onClick={() => setActiveDayBreakdown(d)}
                  className="p-4 transition hover:shadow-md cursor-pointer border border-brand/10 space-y-3"
                >
                  {/* Header: Date + Passed Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand bg-brand-100/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Calendar size={13} />
                        {d.date} {isToday && "(Today)"}
                      </span>
                      <span className="text-[11px] font-semibold text-ink-muted">
                        {d.hoursCount} {d.hoursCount === 1 ? "hour" : "hours"}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-state-success bg-state-success/15 px-2.5 py-1 rounded-full">
                      {num(d.totalGood)} passed
                    </span>
                  </div>

                  {/* Daily Aggregated Metrics Summary */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                      <span className="text-[10px] text-ink-muted uppercase font-bold block">{t("production.inspectedPcs")}</span>
                      <span className="text-sm font-extrabold text-ink">{num(d.totalInspected)}</span>
                    </div>

                    <div className="bg-brand-100/30 p-2 rounded-xl border border-brand/20 text-center">
                      <span className="text-[10px] text-brand uppercase font-bold block">{t("production.defectivePct")}</span>
                      <span className="text-sm font-extrabold text-brand">{d.defRate}%</span>
                    </div>

                    <div className="bg-brand-100/30 p-2 rounded-xl border border-brand/20 text-center">
                      <span className="text-[10px] text-brand uppercase font-bold block">{t("production.dhu")}</span>
                      <span className="text-sm font-extrabold text-brand">{d.dhu}</span>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-ink-muted text-[11px]">
                      Defective Pcs: <strong className="text-state-danger">{num(d.totalDefective)}</strong>
                    </span>
                    <span className="text-brand font-bold underline underline-offset-2">
                      View Hourly Breakdown ({d.hoursCount} hrs) →
                    </span>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>

        {/* Day's Hourly Breakdown Modal */}
        {activeDayBreakdown && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white border-2 border-brand/30 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleUp max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <Calendar size={18} className="text-brand" />
                    {activeDayBreakdown.date} Breakdown
                  </h3>
                  <p className="text-xs text-ink-muted">{currentLineLabel} · Daily Summary & Hourly Details</p>
                </div>
                <button
                  onClick={() => setActiveDayBreakdown(null)}
                  className="p-1 rounded-full text-ink-muted hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Day Overall Summary Banner */}
              <div className="bg-brand-100/40 border border-brand/20 rounded-2xl p-3 flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-brand">
                  <span>Day Totals ({activeDayBreakdown.hoursCount} Hours)</span>
                  <span className="text-state-success bg-white/90 px-2.5 py-0.5 rounded-full border border-state-success/20">
                    {num(activeDayBreakdown.totalGood)} passed / {num(activeDayBreakdown.totalInspected)} inspected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
                    <span className="text-[10px] text-ink-muted font-bold uppercase block">{t("production.defectivePct")}</span>
                    <span className="text-sm font-extrabold text-ink">{activeDayBreakdown.defRate}%</span>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
                    <span className="text-[10px] text-ink-muted font-bold uppercase block">{t("production.dhu")}</span>
                    <span className="text-sm font-extrabold text-ink">{activeDayBreakdown.dhu}</span>
                  </div>
                </div>
              </div>

              {/* Scrollable Hourly Items Breakdown List */}
              <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 no-scrollbar">
                <p className="text-xs font-bold text-ink">{t("production.hourBreakup")}:</p>
                {activeDayBreakdown.hours.map((h) => {
                  const totalInsp = h.goodQty + h.defectivePcs;
                  const defPct = totalInsp === 0 ? "0.0" : ((h.defectivePcs / totalInsp) * 100).toFixed(1);
                  const hourDhu = totalInsp === 0 ? "0.0" : ((h.totalDefects * 100) / totalInsp).toFixed(1);
                  const st = styles.find((s) => s.id === h.styleId);
                  return (
                    <div
                      key={h.id}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2 hover:border-brand/30 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-brand flex items-center gap-1.5 bg-brand-100/50 px-2.5 py-0.5 rounded-full">
                          <Clock size={13} />
                          {h.hourSlot}
                        </span>
                        <span className="font-bold text-state-success bg-state-success/15 px-2.5 py-0.5 rounded-full">
                          {num(h.goodQty)} passed
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-ink-muted">
                        <span>Style: {st ? `${st.code} (${st.name})` : h.styleId}</span>
                        <span>{new Date(h.enteredAt).toLocaleTimeString()}</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] pt-1 border-t border-slate-200/50">
                        <div className="bg-white p-1 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-ink-muted font-bold block">INSPECTED</span>
                          <span className="font-extrabold text-ink">{num(totalInsp)}</span>
                        </div>
                        <div className="bg-white p-1 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-state-danger font-bold block">DEFECTIVE</span>
                          <span className="font-extrabold text-state-danger">{num(h.defectivePcs)}</span>
                        </div>
                        <div className="bg-white p-1 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-brand font-bold block">DEF %</span>
                          <span className="font-extrabold text-brand">{defPct}%</span>
                        </div>
                        <div className="bg-white p-1 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-brand font-bold block">DHU</span>
                          <span className="font-extrabold text-brand">{hourDhu}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const activeLineStyle = lineStylesState.find((x) => x.lineId === lineId && !x.unloadedAt && x.status !== "closed" && x.status !== "queued");
  const activeStyleObj = activeLineStyle ? styles.find((s) => s.id === activeLineStyle.styleId) : null;

  const upcomingLineStyle = lineStylesState.find((x) => x.lineId === lineId && x.status === "queued" && !x.unloadedAt);
  const upcomingStyleObj = upcomingLineStyle ? styles.find((s) => s.id === upcomingLineStyle.styleId) : null;

  // Main Production Entry Screen
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Running Style Card (above Hourly Production) */}
      <GlassCard level="solid" hairline className="p-3 bg-gradient-to-r from-brand-50/90 to-purple-50/90 border border-brand/20 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-brand text-white flex items-center justify-center font-bold shrink-0 shadow-sm text-base">
              👕
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 block">
                Running Style
              </span>
              {activeStyleObj ? (
                <p className="text-xs font-bold text-ink truncate">
                  {activeStyleObj.code} · {activeStyleObj.name}
                  <span className="text-[10px] font-normal text-ink-muted ml-1.5 hidden sm:inline">
                    (SAM: {activeLineStyle?.smv}m)
                  </span>
                </p>
              ) : (
                <p className="text-xs font-bold text-amber-700">No Active Style (Line Paused / Closed)</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeStyleObj && (
            <button
              onClick={() => setShowDowntime(true)}
              className="px-3 py-1.5 rounded-xl bg-state-warning/10 border border-state-warning/40 hover:bg-state-warning hover:text-white text-amber-700 text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
            >
              {t("downtime.log")}
            </button>
            )}
            <button
              onClick={() => setShowEndStyleModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-brand/30 hover:border-brand text-brand-700 text-xs font-bold shadow-sm active:scale-95 transition cursor-pointer"
            >
              {activeStyleObj ? "End Running Style" : "Start Style"}
            </button>
          </div>
        </div>
      </GlassCard>

      {showDowntime && <DowntimeModal lineId={lineId} onClose={() => setShowDowntime(false)} />}

      {/* Header Bar with Title and History Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t("production.title")}</h1>

        {/* History Button (Matches LoadStyle & Attendance pages) */}
        <button
          onClick={() => setSubView("history")}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand glass-1 px-3 py-1.5 rounded-full hover:bg-brand/10 transition active:scale-95 cursor-pointer shadow-pill"
        >
          <History size={14} />
          <span>{t("production.historyOfLine", { line: currentLineLabel })}</span>
        </button>
      </div>

      {/* Supervisor Line Switcher Tabs (If multi-line) */}
      {user.lineIds.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {user.lineIds.map((id) => (
            <button
              key={id}
              onClick={() => setLineId(id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                id === lineId ? "bg-brand text-white shadow-pill" : "glass-1 text-ink-muted"
              }`}
            >
              {lineName(id, lang)}
            </button>
          ))}
        </div>
      )}

      {/* Main Entry Form Card */}
      <GlassCard level="solid" hairline className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ink-muted">{t("production.hourSlot")}</label>
            <span className="text-[11px] font-semibold text-brand bg-brand-100/60 px-2 py-0.5 rounded-full">
              Running: {runningSlot}
            </span>
          </div>

          {/* Hour Slot Selector — Only shows slots that have elapsed up to current hour! */}
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {visibleSlots.map((s) => {
              const done = entered.some((e) => e.hourSlot === s);
              const isRunning = s === runningSlot;
              const slotMeta = allSlotInfos.find((x) => x.slot === s);

              return (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    s === slot
                      ? "bg-brand text-white shadow-sm font-bold"
                      : done
                        ? "bg-state-success/15 text-state-success font-semibold"
                        : isRunning
                          ? "bg-brand-100 border border-brand text-brand-700 font-bold"
                          : "bg-brand-100 text-brand-700 hover:bg-brand-100/80"
                  }`}
                >
                  <span>{s}</span>
                  {slotMeta?.breakName && (
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded-md">
                      {slotMeta.breakMins}m Break
                    </span>
                  )}
                  {isRunning && "•"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs: Total Inspected Pcs, Defective Pcs, Total Defects Found */}
        <div className="glass-solid rounded-2xl px-4 divide-y divide-ink/5 border border-slate-100">
          <Stepper
            label={t("production.inspectedPcs")}
            value={inspected}
            onChange={(v) => setInspected(Math.max(0, v))}
          />
          <Stepper
            label={t("production.defectivePcs")}
            value={defective}
            onChange={(v) => setDefective(Math.max(0, Math.min(inspected, v)))}
          />
          <Stepper
            label={t("production.totalDefects")}
            value={defects}
            onChange={(v) => setDefects(Math.max(0, v))}
          />
        </div>

        {/* Live Automatic Calculations Box */}
        <div className="bg-brand-100/40 border border-brand/20 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-state-success" />
              {t("production.passedPcs")}
            </span>
            <span className="text-lg font-bold text-brand">{num(passedQty)} pcs</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand/10">
            <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
              <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">
                {t("production.defectivePct")}
              </span>
              <span className="text-sm font-extrabold text-ink">{defectivePct}%</span>
            </div>

            <div className="bg-white/80 rounded-xl p-2 text-center border border-slate-100">
              <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">
                {t("production.dhu")}
              </span>
              <span className="text-sm font-extrabold text-ink">{dhu}</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={save}
          className={`w-full font-semibold rounded-2xl py-3.5 transition active:scale-[0.98] shadow-glass flex items-center justify-center gap-2 ${
            flash ? "bg-state-success text-white" : "bg-brand text-white"
          }`}
        >
          {flash ? (
            <>
              <Check size={20} /> {t("production.saved")}
            </>
          ) : (
            t("common.save")
          )}
        </button>
      </GlassCard>


      {/* Single Hour Breakup Detail Modal */}
      {activeBreakup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white border-2 border-brand/30 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-ink">{t("production.hourBreakup")}</h3>
                <p className="text-xs text-ink-muted">{currentLineLabel} · {activeBreakup.date}</p>
              </div>
              <button
                onClick={() => setActiveBreakup(null)}
                className="p-1 rounded-full text-ink-muted hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Slot Badge */}
            <div className="flex items-center justify-between bg-brand-100/40 p-2.5 rounded-2xl">
              <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                <Clock size={14} />
                {activeBreakup.hourSlot}
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                {styles.find((s) => s.id === activeBreakup.styleId)?.code ?? activeBreakup.styleId}
              </span>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-ink-muted text-[10px] uppercase font-bold block">{t("production.inspectedPcs")}</span>
                <span className="text-base font-extrabold text-ink">{num(activeBreakup.goodQty + activeBreakup.defectivePcs)}</span>
              </div>

              <div className="bg-state-success/10 p-2.5 rounded-xl border border-state-success/20">
                <span className="text-state-success text-[10px] uppercase font-bold block">{t("production.passedPcs")}</span>
                <span className="text-base font-extrabold text-state-success">{num(activeBreakup.goodQty)}</span>
              </div>

              <div className="bg-state-danger/10 p-2.5 rounded-xl border border-state-danger/20">
                <span className="text-state-danger text-[10px] uppercase font-bold block">{t("production.defectivePcs")}</span>
                <span className="text-base font-extrabold text-state-danger">{num(activeBreakup.defectivePcs)}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-ink-muted text-[10px] uppercase font-bold block">{t("production.totalDefects")}</span>
                <span className="text-base font-extrabold text-ink">{num(activeBreakup.totalDefects)}</span>
              </div>

              <div className="bg-brand-100/30 p-2.5 rounded-xl border border-brand/20">
                <span className="text-brand text-[10px] uppercase font-bold block">{t("production.defectivePct")}</span>
                <span className="text-base font-extrabold text-brand">
                  {(activeBreakup.goodQty + activeBreakup.defectivePcs) === 0
                    ? "0.0"
                    : (((activeBreakup.defectivePcs) / (activeBreakup.goodQty + activeBreakup.defectivePcs)) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="bg-brand-100/30 p-2.5 rounded-xl border border-brand/20">
                <span className="text-brand text-[10px] uppercase font-bold block">{t("production.dhu")}</span>
                <span className="text-base font-extrabold text-brand">
                  {(activeBreakup.goodQty + activeBreakup.defectivePcs) === 0
                    ? "0.0"
                    : (((activeBreakup.totalDefects * 100) / (activeBreakup.goodQty + activeBreakup.defectivePcs))).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center border-t border-slate-100">
              <span className="text-[11px] text-ink-muted">
                {t("production.recordedAt")}: {new Date(activeBreakup.enteredAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* End / Switch Running Style Modal */}
      {showEndStyleModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-200 animate-rise">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand/10 text-brand font-bold text-lg">👕</div>
                <div>
                  <h3 className="font-bold text-base text-ink">
                    {activeStyleObj ? `End Running Style: ${activeStyleObj.code}` : "Select Style to Run"}
                  </h3>
                  <p className="text-xs text-ink-muted">{lineName(lineId, lang)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEndStyleModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Option A: Pre-loaded Upcoming Style by IE */}
            {upcomingLineStyle && upcomingStyleObj ? (
              <div className="bg-emerald-50/80 border-2 border-emerald-300/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Pre-Loaded Upcoming Style (by IE)
                  </span>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-ink">{upcomingStyleObj.code} · {upcomingStyleObj.name}</p>
                  <p className="text-xs font-semibold text-emerald-900 mt-0.5">
                    SAM: {upcomingLineStyle.smv} mins | CM: ${upcomingLineStyle.cmPerPcUsd.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (activeLineStyle) endRunningStyle(lineId);
                    startQueuedStyle(upcomingLineStyle.id);
                    setShowEndStyleModal(false);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play size={15} />
                  <span>Start Next Style ({upcomingStyleObj.code})</span>
                </button>
              </div>
            ) : (
              /* Option B: Close / Pause Line (only if no next style loaded) */
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-bold">No upcoming style pre-loaded by IE.</p>
                  <p className="text-[11px] opacity-90 leading-tight">
                    Ending this style will close/pause the line with no active running style until IE loads a new style.
                  </p>
                </div>

                <button
                  onClick={() => {
                    endRunningStyle(lineId);
                    setShowEndStyleModal(false);
                  }}
                  className="w-full bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 font-bold py-3 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <XCircle size={15} />
                  <span>Close / Pause Line (No Running Style)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
