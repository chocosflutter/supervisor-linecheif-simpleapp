import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  AlertTriangle,
  Check,
  Send,
  Clock,
  Layers,
  Users,
} from "lucide-react";
import { useApp } from "@/store/appStore";
import { TODAY } from "@/lib/today";
import { lineName } from "@/lib/names";
import GlassCard from "@/components/GlassCard";
import AlertThread from "@/components/AlertThread";

interface IeAuditModalProps {
  initialLineId?: string | null;
  initialTab?: "production" | "defects" | "attendance";
  onClose: () => void;
}

export default function IeAuditModal({ initialLineId, initialTab = "production", onClose }: IeAuditModalProps) {
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
  const lines = useApp((s) => s.lines);
  const floors = useApp((s) => s.floors);
  const units = useApp((s) => s.units);
  const styles = useApp((s) => s.styles);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [selectedLine, setSelectedLine] = useState<string>(initialLineId ?? "all");
  const [activeTab, setActiveTab] = useState<"production" | "defects" | "attendance">(initialTab);

  // Alert Note Creation State
  const [flaggingEntryKey, setFlaggingEntryKey] = useState<string | null>(null);
  const [alertNote, setAlertNote] = useState("");
  const [alertSubmittedKey, setAlertSubmittedKey] = useState<string | null>(null);

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

  const lineIdsSet = useMemo(() => new Set(filteredLines.map((l) => l.id)), [filteredLines]);

  // Production entries
  const productionEntries = useMemo(() => {
    return production.filter((p) => lineIdsSet.has(p.lineId) && p.date === TODAY);
  }, [production, lineIdsSet]);

  // Attendance entries
  const attendanceEntries = useMemo(() => {
    return attendance.filter((a) => lineIdsSet.has(a.lineId) && a.date === TODAY);
  }, [attendance, lineIdsSet]);

  const handleRaiseAlert = (lineId: string, category: "production" | "defects" | "attendance" | "style", refKey: string) => {
    if (!alertNote.trim()) return;
    raiseAlert({
      id: `alt-${Date.now()}`,
      lineId,
      category,
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

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Card — 100% Solid Opaque White */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-modal z-10">
        {/* Modal Drag Handle */}
        <div className="w-12 h-1 bg-ink/15 rounded-full mx-auto my-2 shrink-0" />

        {/* Modal Header */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-ink">Line Entry Audit & Alerts</h2>
            <p className="text-[11px] text-ink-muted">Inspect supervisor entries and flag errors</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full glass-1 text-ink-muted hover:text-ink hover:bg-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-100 space-y-2 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter lines or style..."
              className="w-full bg-white border border-brand/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
            />
          </div>

          {/* Unit / Floor / Line Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
            {/* Unit Dropdown */}
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setSelectedFloor("all");
              }}
              className="bg-white border border-brand/20 rounded-lg px-2 py-1 text-xs text-ink font-medium shadow-sm outline-none"
            >
              <option value="all">All Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {lang === "bn" ? u.name_bn : u.name_en}
                </option>
              ))}
            </select>

            {/* Floor Dropdown */}
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-white border border-brand/20 rounded-lg px-2 py-1 text-xs text-ink font-medium shadow-sm outline-none"
            >
              <option value="all">All Floors</option>
              {floors
                .filter((f) => selectedUnit === "all" || f.unitId === selectedUnit)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {lang === "bn" ? f.name_bn : f.name_en}
                  </option>
                ))}
            </select>

            {/* Line Dropdown */}
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-white border border-brand/20 rounded-lg px-2 py-1 text-xs text-ink font-medium shadow-sm outline-none"
            >
              <option value="all">All Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {lineName(l.id, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-around border-b border-slate-100 bg-white px-2 py-1.5 shrink-0">
          <button
            onClick={() => setActiveTab("production")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "production"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Layers size={14} />
            <span>Production ({productionEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("defects")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "defects"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <AlertTriangle size={14} />
            <span>Defects Audit</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "attendance"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Users size={14} />
            <span>Attendance ({attendanceEntries.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
          {/* TAB 1: PRODUCTION ENTRIES */}
          {activeTab === "production" && (
            productionEntries.length === 0 ? (
              <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
                No hourly production entries logged for selected filters today.
              </GlassCard>
            ) : (
              productionEntries.map((p) => {
                const refKey = `prod-${p.id}`;
                const isFlagging = flaggingEntryKey === refKey;
                const isSubmitted = alertSubmittedKey === refKey;
                const existingAlerts = alerts.filter((a) => a.entryRef === refKey);
                const activeLs = lineStyles.find((x) => x.lineId === p.lineId && !x.unloadedAt);
                const style = styles.find((s) => s.id === p.styleId || s.id === activeLs?.styleId);

                return (
                  <GlassCard key={p.id} level={2} className="p-3 space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink">{lineName(p.lineId, lang)}</span>
                        <span className="text-[10px] bg-brand-100 text-brand font-semibold px-2 py-0.5 rounded-full">
                          {p.hourSlot}
                        </span>
                      </div>
                      <span className="text-[10px] text-ink-muted flex items-center gap-1">
                        <Clock size={11} className="text-brand" />
                        {new Date(p.enteredAt).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Style</span>
                        <span className="font-bold text-ink truncate block">{style?.code ?? p.styleId}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Inspected Pcs</span>
                        <span className="font-bold text-emerald-700 block">{p.goodQty + p.defectivePcs}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Passed (Good)</span>
                        <span className="font-bold text-brand block">{p.goodQty}</span>
                      </div>
                    </div>

                    {/* Raised Alert History if any */}
                    <AlertThread alerts={existingAlerts} openLabel="Active Alert Raised to Supervisor" />

                    {/* Raise Alert Controls */}
                    {isSubmitted ? (
                      <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <Check size={14} /> Alert raised & Supervisor notified!
                      </div>
                    ) : isFlagging ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={alertNote}
                          onChange={(e) => setAlertNote(e.target.value)}
                          placeholder="Describe the issue for Supervisor..."
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
                            onClick={() => handleRaiseAlert(p.lineId, "production", refKey)}
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
                          <span>Raise Alert</span>
                        </button>
                      </div>
                    )}
                  </GlassCard>
                );
              })
            )
          )}

          {/* TAB 2: DEFECTS AUDIT */}
          {activeTab === "defects" && (
            productionEntries.length === 0 ? (
              <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
                No defect records logged for selected filters today.
              </GlassCard>
            ) : (
              productionEntries.map((p) => {
                const refKey = `def-${p.id}`;
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
                        <span className="font-bold text-xs text-ink">{lineName(p.lineId, lang)}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                          {p.hourSlot}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {defectivePct}% Defective
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defective Pcs</span>
                        <span className="font-bold text-state-danger block">{p.defectivePcs} pcs</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">Defects Found</span>
                        <span className="font-bold text-amber-800 block">{p.totalDefects}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-semibold text-ink-muted block">DHU</span>
                        <span className="font-bold text-ink block">{dhu}</span>
                      </div>
                    </div>

                    <AlertThread alerts={existingAlerts} openLabel="Defects Alert Raised" />

                    {isSubmitted ? (
                      <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <Check size={14} /> Defect alert sent to Supervisor!
                      </div>
                    ) : isFlagging ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={alertNote}
                          onChange={(e) => setAlertNote(e.target.value)}
                          placeholder="Why is this defect count suspicious?..."
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
                            onClick={() => handleRaiseAlert(p.lineId, "defects", refKey)}
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
                          <span>Flag Defect Entry</span>
                        </button>
                      </div>
                    )}
                  </GlassCard>
                );
              })
            )
          )}

          {/* TAB 3: ATTENDANCE RECORDS */}
          {activeTab === "attendance" && (
            attendanceEntries.length === 0 ? (
              <GlassCard level={2} className="p-6 text-center text-ink-muted text-xs font-medium">
                No attendance entries submitted for selected lines today.
              </GlassCard>
            ) : (
              attendanceEntries.map((att) => {
                const refKey = `att-${att.lineId}-${att.date}`;
                const isFlagging = flaggingEntryKey === refKey;
                const isSubmitted = alertSubmittedKey === refKey;
                const existingAlerts = alerts.filter((a) => a.entryRef === refKey);
                const activeLs = lineStyles.find((x) => x.lineId === att.lineId && !x.unloadedAt);
                const plannedWf = activeLs?.plannedWorkforce;
                const totalPresent = att.operators + att.helpers + att.pressmen + att.checkers;

                return (
                  <GlassCard key={refKey} level={2} className="p-3 space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-ink">{lineName(att.lineId, lang)}</span>
                      <span className="text-[10px] font-bold text-brand bg-brand-100 px-2 py-0.5 rounded-full">
                        {totalPresent} Present
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs bg-slate-50/80 p-2 rounded-xl">
                      <div>
                        <span className="text-[9px] text-ink-muted block">Operators</span>
                        <span className="font-bold text-ink">{att.operators}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-ink-muted block">Helpers</span>
                        <span className="font-bold text-ink">{att.helpers}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-ink-muted block">Pressmen</span>
                        <span className="font-bold text-ink">{att.pressmen}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-ink-muted block">Checkers</span>
                        <span className="font-bold text-ink">{att.checkers}</span>
                      </div>
                    </div>

                    {plannedWf && typeof plannedWf === "object" && (
                      <div className="text-[10px] text-ink-muted px-1 flex items-center justify-between border-t border-slate-100 pt-1.5">
                        <span>Planned: {plannedWf.operators} Op · {plannedWf.helpers} Hlp · {plannedWf.pressmen} Prs · {plannedWf.checkers} Chk</span>
                      </div>
                    )}

                    <AlertThread alerts={existingAlerts} openLabel="Attendance Discrepancy Alert" />

                    {isSubmitted ? (
                      <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <Check size={14} /> Attendance alert sent to Supervisor!
                      </div>
                    ) : isFlagging ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={alertNote}
                          onChange={(e) => setAlertNote(e.target.value)}
                          placeholder="Describe headcount discrepancy..."
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
                            onClick={() => handleRaiseAlert(att.lineId, "attendance", refKey)}
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
                          <span>Flag Attendance</span>
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
    document.body!
  );
}
