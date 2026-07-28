import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  AlertTriangle,
  Check,
  Send,
  Clock,
  Layers,
  Users,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { useApp } from "@/store/appStore";
import { TODAY } from "@/lib/today";
import { lineName } from "@/lib/names";
import GlassCard from "@/components/GlassCard";
import CustomSelect from "@/components/CustomSelect";
import AlertThread from "@/components/AlertThread";

/* ================================================================== */
/*                Line Hourly Breakdown & Flag Modal                  */
/* ================================================================== */
interface LineAuditModalProps {
  lineId: string;
  category: "production" | "attendance";
  onClose: () => void;
}

function LineAuditModal({ lineId, category, onClose }: LineAuditModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const production = useApp((s) => s.production);
  const attendance = useApp((s) => s.attendance);
  const lineStyles = useApp((s) => s.lineStyles);
  const alerts = useApp((s) => s.alerts);
  const raiseAlert = useApp((s) => s.raiseAlert);
  const styles = useApp((s) => s.styles);

  const activeLs = lineStyles.find((x) => x.lineId === lineId && !x.unloadedAt);
  const style = styles.find((s) => s.id === activeLs?.styleId);

  const lineProdHours = useMemo(() => {
    return production
      .filter((p) => p.lineId === lineId && p.date === TODAY)
      .sort((a, b) => a.hourSlot.localeCompare(b.hourSlot));
  }, [production, lineId]);

  const lineAttendance = useMemo(() => {
    return attendance.find((a) => a.lineId === lineId && a.date === TODAY);
  }, [attendance, lineId]);

  // Alert Note Creation State
  const [flaggingEntryKey, setFlaggingEntryKey] = useState<string | null>(null);
  const [alertNote, setAlertNote] = useState("");
  const [alertSubmittedKey, setAlertSubmittedKey] = useState<string | null>(null);

  const handleRaiseAlert = (refCategory: "production" | "defects" | "attendance" | "style", refKey: string) => {
    if (!alertNote.trim()) return;
    raiseAlert({
      id: `alt-${Date.now()}`,
      lineId,
      category: refCategory,
      entryRef: refKey,
      note: alertNote.trim(),
      raisedBy: user.name,
      raisedAt: new Date().toISOString(),
      status: "open",
    });
    setAlertSubmittedKey(refKey);
    setFlaggingEntryKey(null);
    setAlertNote("");
    setTimeout(() => setAlertSubmittedKey(null), 3000);
  };

  const totalGood = lineProdHours.reduce((acc, p) => acc + p.goodQty, 0);
  const totalDefective = lineProdHours.reduce((acc, p) => acc + p.defectivePcs, 0);
  const totalDefects = lineProdHours.reduce((acc, p) => acc + p.totalDefects, 0);
  const totalInspected = totalGood + totalDefective;
  const lineDefectPct = totalInspected > 0 ? ((totalDefective / totalInspected) * 100).toFixed(1) : "0.0";
  const lineDhu = totalInspected > 0 ? ((totalDefects * 100) / totalInspected).toFixed(1) : "0.0";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 pb-[max(5.5rem,env(safe-area-inset-bottom))] sm:pb-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Card — 100% Opaque White */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden animate-rise z-10">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-ink">{lineName(lineId, lang)}</span>
              {style && (
                <span className="text-[10px] bg-brand-100 text-brand font-semibold px-2.5 py-0.5 rounded-full">
                  {style.code}
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-muted">Hourly Entries & Supervisor Flags · {TODAY}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-200/80 text-ink-muted hover:text-ink hover:bg-slate-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Line High-Level Summary Strip */}
        <div className="p-3 bg-brand/5 border-b border-brand/10 grid grid-cols-4 gap-1.5 text-center text-xs shrink-0">
          <div>
            <span className="text-[9px] uppercase font-semibold text-ink-muted block">Inspected</span>
            <span className="font-bold text-slate-800 text-xs">{totalInspected} pcs</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-semibold text-ink-muted block">Passed (Good)</span>
            <span className="font-bold text-brand text-xs">{totalGood} pcs</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defective Rate</span>
            <span className="font-bold text-state-danger text-xs">{lineDefectPct}%</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-semibold text-ink-muted block">DHU</span>
            <span className="font-bold text-amber-800 text-xs">{lineDhu}</span>
          </div>
        </div>

        {/* Scrollable Hourly List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
          {category === "attendance" ? (
            /* Attendance Detail View */
            !lineAttendance ? (
              <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
                No attendance record submitted for this line today.
              </GlassCard>
            ) : (
              (() => {
                const refKey = `att-${lineAttendance.lineId}-${lineAttendance.date}`;
                const isFlagging = flaggingEntryKey === refKey;
                const isSubmitted = alertSubmittedKey === refKey;
                const existingAlerts = alerts.filter((a) => a.entryRef === refKey);
                const totalPresent = lineAttendance.operators + lineAttendance.helpers + lineAttendance.pressmen + lineAttendance.checkers;

                return (
                  <GlassCard level={2} className="p-4 space-y-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-ink">Daily Headcount Record</span>
                      <span className="text-xs font-bold text-brand bg-brand-100 px-3 py-1 rounded-full">
                        {totalPresent} Present
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs bg-slate-50 p-3 rounded-xl">
                      <div>
                        <span className="text-[10px] text-ink-muted block">Operators</span>
                        <span className="font-bold text-ink text-sm">{lineAttendance.operators}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">Helpers</span>
                        <span className="font-bold text-ink text-sm">{lineAttendance.helpers}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">Pressmen</span>
                        <span className="font-bold text-ink text-sm">{lineAttendance.pressmen}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">Checkers</span>
                        <span className="font-bold text-ink text-sm">{lineAttendance.checkers}</span>
                      </div>
                    </div>

                    <AlertThread alerts={existingAlerts} openLabel="Active Attendance Alert Raised" />

                    {isSubmitted ? (
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
                        <Check size={14} /> Attendance alert sent to Supervisor!
                      </div>
                    ) : isFlagging ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={alertNote}
                          onChange={(e) => setAlertNote(e.target.value)}
                          placeholder="Describe headcount discrepancy..."
                          className="w-full bg-white border border-state-danger/40 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-state-danger"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setFlaggingEntryKey(null)}
                            className="px-3 py-1 text-xs text-ink-muted hover:bg-slate-100 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRaiseAlert("attendance", refKey)}
                            className="px-3.5 py-1.5 text-xs font-bold bg-state-danger text-white rounded-xl flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Send size={12} /> Send Alert
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            setFlaggingEntryKey(refKey);
                            setAlertNote("");
                          }}
                          className="text-xs text-state-danger font-semibold bg-state-danger/10 hover:bg-state-danger hover:text-white px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 border border-state-danger/20 active:scale-95"
                        >
                          <AlertTriangle size={13} />
                          <span>Flag Attendance Entry</span>
                        </button>
                      </div>
                    )}
                  </GlassCard>
                );
              })()
            )
          ) : (
            /* Production Hourly Slot List with Inspected, Passed, Defective, Defects, Defective %, DHU */
            lineProdHours.length === 0 ? (
              <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
                No hourly entries logged for this line today.
              </GlassCard>
            ) : (
              lineProdHours.map((p) => {
                const refKey = `prod-${p.id}`;
                const isFlagging = flaggingEntryKey === refKey;
                const isSubmitted = alertSubmittedKey === refKey;
                const existingAlerts = alerts.filter((a) => a.entryRef === refKey);
                const inspected = p.goodQty + p.defectivePcs;
                const defectivePct = inspected > 0 ? ((p.defectivePcs / inspected) * 100).toFixed(1) : "0.0";
                const dhu = inspected > 0 ? ((p.totalDefects * 100) / inspected).toFixed(1) : "0.0";

                return (
                  <GlassCard key={p.id} level={2} className="p-3 space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand bg-brand-100 px-2.5 py-0.5 rounded-full">
                          Slot: {p.hourSlot}
                        </span>
                      </div>
                      <span className="text-[10px] text-ink-muted flex items-center gap-1">
                        <Clock size={11} className="text-brand" />
                        {new Date(p.enteredAt).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Detailed Production Breakdown Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Inspected Pcs</span>
                        <span className="font-bold text-slate-800 block">{inspected} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Passed (Good)</span>
                        <span className="font-bold text-brand block">{p.goodQty} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defective Pcs</span>
                        <span className="font-bold text-state-danger block">{p.defectivePcs} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defects Found</span>
                        <span className="font-bold text-amber-800 block">{p.totalDefects}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defective %</span>
                        <span className="font-bold text-state-danger block">{defectivePct}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">DHU</span>
                        <span className="font-bold text-amber-800 block">{dhu}</span>
                      </div>
                    </div>

                    <AlertThread alerts={existingAlerts} openLabel="Active Alert Raised for this Hour" />

                    {isSubmitted ? (
                      <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <Check size={14} /> Alert sent to Supervisor!
                      </div>
                    ) : isFlagging ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={alertNote}
                          onChange={(e) => setAlertNote(e.target.value)}
                          placeholder="Describe the issue for Supervisor in this hour slot..."
                          className="w-full bg-white border border-state-danger/40 rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-state-danger"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setFlaggingEntryKey(null)}
                            className="px-2.5 py-1 text-xs text-ink-muted hover:bg-slate-100 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRaiseAlert("production", refKey)}
                            className="px-3 py-1 text-xs font-bold bg-state-danger text-white rounded-lg flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Send size={12} /> Send Alert
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            setFlaggingEntryKey(refKey);
                            setAlertNote("");
                          }}
                          className="text-[11px] text-state-danger font-semibold bg-state-danger/10 hover:bg-state-danger hover:text-white px-3 py-1 rounded-xl transition flex items-center gap-1 border border-state-danger/20 active:scale-95"
                        >
                          <AlertTriangle size={12} />
                          <span>Flag Hour {p.hourSlot}</span>
                        </button>
                      </div>
                    )}
                  </GlassCard>
                );
              })
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/*                     Main IeAuditView Component                     */
/* ================================================================== */
export default function IeAuditView() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "production" | "attendance" | null;

  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const production = useApp((s) => s.production);
  const attendance = useApp((s) => s.attendance);
  const lineStyles = useApp((s) => s.lineStyles);
  const lines = useApp((s) => s.lines);
  const floors = useApp((s) => s.floors);
  const units = useApp((s) => s.units);
  const styles = useApp((s) => s.styles);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"production" | "attendance">(
    tabParam && ["production", "attendance"].includes(tabParam) ? tabParam : "production"
  );

  // Selected Line Modal State
  const [activeModalLineId, setActiveModalLineId] = useState<string | null>(null);

  // Filter lines by unit & floor
  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      const fl = floors.find((f) => f.id === l.floorId);
      const matchesUnit = selectedUnit === "all" || fl?.unitId === selectedUnit;
      const matchesFloor = selectedFloor === "all" || l.floorId === selectedFloor;
      const matchesLine = selectedLine === "all" || l.id === selectedLine;
      const lName = lineName(l.id, lang).toLowerCase();
      const matchesSearch = !searchQuery.trim() || lName.includes(searchQuery.toLowerCase());
      return matchesUnit && matchesFloor && matchesLine && matchesSearch;
    });
  }, [selectedUnit, selectedFloor, selectedLine, searchQuery, lang]);

  return (
    <div className="space-y-4 animate-rise pb-24">
      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          {user.name} · {t("roles.ie")}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="text-xl font-bold text-ink">Line Level Entry Audit</h1>
          <span className="text-xs font-bold text-brand bg-brand-100/80 border border-brand/20 px-3 py-1 rounded-full shadow-sm">
            {TODAY}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted mt-0.5">Select a line to inspect hourly logs and flag discrepancies</p>
      </div>

      {/* Filter Toolbar */}
      <GlassCard level="solid" className="p-3 space-y-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search line name or floor..."
            className="w-full bg-white border border-brand/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
          />
        </div>

        {/* Unit / Floor / Line Custom Selectors */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <CustomSelect
            value={selectedUnit}
            onChange={(val) => {
              setSelectedUnit(val);
              setSelectedFloor("all");
              setSelectedLine("all");
            }}
            options={[
              { value: "all", label: "All Units" },
              ...units.map((u) => ({ value: u.id, label: lang === "bn" ? u.name_bn : u.name_en })),
            ]}
          />

          <CustomSelect
            value={selectedFloor}
            onChange={(val) => {
              setSelectedFloor(val);
              setSelectedLine("all");
            }}
            options={[
              { value: "all", label: "All Floors" },
              ...floors
                .filter((f) => selectedUnit === "all" || f.unitId === selectedUnit)
                .map((f) => ({ value: f.id, label: lang === "bn" ? f.name_bn : f.name_en })),
            ]}
          />

          <CustomSelect
            value={selectedLine}
            onChange={(val) => setSelectedLine(val)}
            options={[
              { value: "all", label: "All Lines" },
              ...lines
                .filter((l) => {
                  const fl = floors.find((f) => f.id === l.floorId);
                  const matchesUnit = selectedUnit === "all" || fl?.unitId === selectedUnit;
                  const matchesFloor = selectedFloor === "all" || l.floorId === selectedFloor;
                  return matchesUnit && matchesFloor;
                })
                .map((l) => ({ value: l.id, label: lineName(l.id, lang) })),
            ]}
          />
        </div>
      </GlassCard>

      {/* Category Tabs (Production & Attendance) */}
      <div className="flex items-center justify-around glass-1 rounded-card shadow-pill px-2 py-1.5">
        <button
          onClick={() => setActiveTab("production")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "production"
              ? "bg-brand text-white shadow-sm"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Layers size={14} />
          <span>Production Logs & Quality</span>
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "attendance"
              ? "bg-brand text-white shadow-sm"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Users size={14} />
          <span>Attendance</span>
        </button>
      </div>

      {/* Line Level Summary Cards Grid */}
      <div className="space-y-3">
        {filteredLines.length === 0 ? (
          <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
            No lines match the selected unit/floor filter.
          </GlassCard>
        ) : (
          filteredLines.map((line) => {
            const activeLs = lineStyles.find((x) => x.lineId === line.id && !x.unloadedAt);
            const style = styles.find((s) => s.id === activeLs?.styleId);
            const lineProds = production.filter((p) => p.lineId === line.id && p.date === TODAY);
            const lineAtt = attendance.find((a) => a.lineId === line.id && a.date === TODAY);

            const goodQtySum = lineProds.reduce((sum, p) => sum + p.goodQty, 0);
            const defectivePcsSum = lineProds.reduce((sum, p) => sum + p.defectivePcs, 0);
            const totalDefectsSum = lineProds.reduce((sum, p) => sum + p.totalDefects, 0);
            const inspectedSum = goodQtySum + defectivePcsSum;
            const defectivePct = inspectedSum > 0 ? ((defectivePcsSum / inspectedSum) * 100).toFixed(1) : "0.0";
            const dhu = inspectedSum > 0 ? ((totalDefectsSum * 100) / inspectedSum).toFixed(1) : "0.0";
            const totalHeadcount = lineAtt ? lineAtt.operators + lineAtt.helpers + lineAtt.pressmen + lineAtt.checkers : 0;

            return (
              <GlassCard
                key={line.id}
                level={2}
                onClick={() => setActiveModalLineId(line.id)}
                className="p-3.5 relative overflow-hidden cursor-pointer hover:border-brand/40 active:scale-[0.99] transition shadow-sm border border-slate-100 flex items-center justify-between"
              >
                <div className="space-y-2 flex-1 pr-3">
                  {/* Line Title & Style */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-ink">{lineName(line.id, lang)}</span>
                    {style ? (
                      <span className="text-[10px] bg-brand-100 text-brand font-semibold px-2 py-0.5 rounded-full">
                        {style.code}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                        No Style Loaded
                      </span>
                    )}
                  </div>

                  {/* Complete Production Metrics Breakdown */}
                  {activeTab === "production" && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Inspected</span>
                        <span className="font-bold text-slate-800">{inspectedSum} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Passed (Good)</span>
                        <span className="font-bold text-brand">{goodQtySum} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Defective</span>
                        <span className="font-bold text-state-danger">{defectivePcsSum} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Defects Found</span>
                        <span className="font-bold text-amber-800">{totalDefectsSum}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Defective %</span>
                        <span className="font-bold text-state-danger">{defectivePct}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">DHU</span>
                        <span className="font-bold text-amber-800">{dhu}</span>
                      </div>
                    </div>
                  )}

                  {activeTab === "attendance" && (
                    <div className="flex items-center gap-3 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[9px] uppercase text-ink-muted block font-semibold">Headcount</span>
                        <span className="font-bold text-brand">{totalHeadcount > 0 ? `${totalHeadcount} Present` : "Not Logged"}</span>
                      </div>
                      {lineAtt && (
                        <span className="text-[10px] text-ink-muted">
                          {lineAtt.operators} Op · {lineAtt.helpers} Hlp · {lineAtt.pressmen} Prs · {lineAtt.checkers} Chk
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inspect Button & Chevron */}
                <div className="flex items-center gap-1 text-xs font-semibold text-brand bg-brand-100/70 hover:bg-brand hover:text-white px-3 py-1.5 rounded-xl transition shrink-0">
                  <FileText size={14} />
                  <span>Inspect</span>
                  <ChevronRight size={14} />
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Hourly Inspector & Alert Flag Modal for Selected Line */}
      {activeModalLineId && (
        <LineAuditModal
          lineId={activeModalLineId}
          category={activeTab}
          onClose={() => setActiveModalLineId(null)}
        />
      )}
    </div>
  );
}
