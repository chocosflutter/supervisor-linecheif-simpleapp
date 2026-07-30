import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, History, ArrowLeft, Search, Edit2, Clock, X, ChevronDown, Printer } from "lucide-react";
import type { LineStyle } from "@/types";
import { useApp } from "@/store/appStore";
import { lineName, floorName, unitName, localName } from "@/lib/names";
import { TODAY } from "@/lib/today";
import { money } from "@/lib/format";
import { countWorkingDays } from "@/lib/calendar";
import GlassCard from "@/components/GlassCard";
import Stepper from "@/components/Stepper";
import PrintableStyleSheet from "@/components/PrintableStyleSheet";

/* ================================================================== */
/*   LineSelector: Unit → Floor → Line (3 mini-dropdowns, same row)   */
/* ================================================================== */
function LineSelector({ lineId, onChange }: { lineId: string; onChange: (id: string) => void }) {
  const lang = useApp((s) => s.lang);
  const units = useApp((s) => s.units);
  const floors = useApp((s) => s.floors);
  const lines = useApp((s) => s.lines);
  const user = useApp((s) => s.user);

  const availableLines = useMemo(() => {
    if (!user) return lines;
    return user.lineIds.length > 0 ? lines.filter((l) => user.lineIds.includes(l.id)) : lines;
  }, [user, lines]);

  // Derive unit/floor from current lineId
  const currentLine = availableLines.find((l) => l.id === lineId);
  const currentFloor = floors.find((f) => f.id === currentLine?.floorId);
  const currentUnit = units.find((u) =>
    floors.filter((f) => f.unitId === u.id).some((f) => f.id === currentFloor?.id)
  );

  const [unitId, setUnitId] = useState(currentUnit?.id ?? units[0]?.id ?? "");
  const [floorId, setFloorId] = useState(currentFloor?.id ?? "");
  const [openDrop, setOpenDrop] = useState<"unit" | "floor" | "line" | null>(null);

  const unitFloors = useMemo(() => floors.filter((f) => f.unitId === unitId), [floors, unitId]);
  const floorLines = useMemo(() => {
    const fl = floorId ? availableLines.filter((l) => l.floorId === floorId) : [];
    return fl;
  }, [availableLines, floorId]);

  const selectUnit = (id: string) => {
    setUnitId(id);
    const firstFloor = floors.find((f) => f.unitId === id);
    setFloorId(firstFloor?.id ?? "");
    const firstLine = firstFloor ? availableLines.find((l) => l.floorId === firstFloor.id) : undefined;
    if (firstLine) onChange(firstLine.id);
    setOpenDrop(null);
  };

  const selectFloor = (id: string) => {
    setFloorId(id);
    const firstLine = availableLines.find((l) => l.floorId === id);
    if (firstLine) onChange(firstLine.id);
    setOpenDrop(null);
  };

  const selectLine = (id: string) => {
    onChange(id);
    setOpenDrop(null);
  };

  const btnClass = (active: boolean) =>
    `flex-1 min-w-0 bg-white border rounded-xl px-2.5 py-2.5 text-xs font-semibold text-ink flex items-center justify-between shadow-sm transition active:scale-[0.99] cursor-pointer truncate ${
      active ? "border-brand ring-2 ring-brand/30" : "border-brand/20 hover:border-brand/40"
    }`;

  return (
    <div className="flex items-start gap-2 relative">
      {openDrop && <div className="fixed inset-0 z-40" onClick={() => setOpenDrop(null)} />}

      {/* Unit */}
      <div className="relative flex-1 min-w-0">
        <button type="button" onClick={() => setOpenDrop(openDrop === "unit" ? null : "unit")} className={btnClass(openDrop === "unit")}>
          <span className="truncate">{unitId ? unitName(unitId, lang) || "Unit" : "Unit"}</span>
          <ChevronDown size={14} className="text-ink-muted shrink-0 ml-1" />
        </button>
        {openDrop === "unit" && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-brand/30 rounded-xl shadow-2xl p-1 space-y-0.5 z-50 max-h-44 overflow-y-auto no-scrollbar animate-fadeIn">
            {units.map((u) => (
              <button key={u.id} type="button" onClick={() => selectUnit(u.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${unitId === u.id ? "bg-brand text-white" : "hover:bg-slate-100"}`}>
                {localName(u, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floor */}
      <div className="relative flex-1 min-w-0">
        <button type="button" onClick={() => setOpenDrop(openDrop === "floor" ? null : "floor")} className={btnClass(openDrop === "floor")}>
          <span className="truncate">{floorId ? floorName(floorId, lang) || "Floor" : "Floor"}</span>
          <ChevronDown size={14} className="text-ink-muted shrink-0 ml-1" />
        </button>
        {openDrop === "floor" && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-brand/30 rounded-xl shadow-2xl p-1 space-y-0.5 z-50 max-h-44 overflow-y-auto no-scrollbar animate-fadeIn">
            {unitFloors.map((f) => (
              <button key={f.id} type="button" onClick={() => selectFloor(f.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${floorId === f.id ? "bg-brand text-white" : "hover:bg-slate-100"}`}>
                {localName(f, lang)}
              </button>
            ))}
            {unitFloors.length === 0 && <p className="text-[11px] text-ink-muted italic px-3 py-2">No floors</p>}
          </div>
        )}
      </div>

      {/* Line */}
      <div className="relative flex-1 min-w-0">
        <button type="button" onClick={() => setOpenDrop(openDrop === "line" ? null : "line")} className={btnClass(openDrop === "line")}>
          <span className="truncate">{lineId ? lineName(lineId, lang) || "Line" : "Line"}</span>
          <ChevronDown size={14} className="text-ink-muted shrink-0 ml-1" />
        </button>
        {openDrop === "line" && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-brand/30 rounded-xl shadow-2xl p-1 space-y-0.5 z-50 max-h-44 overflow-y-auto no-scrollbar animate-fadeIn">
            {floorLines.map((l) => (
              <button key={l.id} type="button" onClick={() => selectLine(l.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${lineId === l.id ? "bg-brand text-white" : "hover:bg-slate-100"}`}>
                {localName(l, lang)}
              </button>
            ))}
            {floorLines.length === 0 && <p className="text-[11px] text-ink-muted italic px-3 py-2">No lines</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoadStyle() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const currency = useApp((s) => s.settings.displayCurrency);
  const fxRates = useApp((s) => s.fxRates);
  const loadStyle = useApp((s) => s.loadStyle);
  const updateLineStyleParams = useApp((s) => s.updateLineStyleParams);
  const lineStyles = useApp((s) => s.lineStyles);
  const styles = useApp((s) => s.styles);
  const lines = useApp((s) => s.lines);

  const availableLineIds = useMemo(() => {
    return user.lineIds && user.lineIds.length > 0 ? user.lineIds : lines.map((l) => l.id);
  }, [user.lineIds]);

  const [subView, setSubView] = useState<"load" | "history">("load");

  // Load Style Form State
  const [lineId, setLineId] = useState(availableLineIds[0] ?? "");
  const [styleText, setStyleText] = useState("");
  const [cmLocal, setCmLocal] = useState(100);
  const [smv, setSmv] = useState(14);
  const [wfBreakdown, setWfBreakdown] = useState({
    operators: 24,
    helpers: 6,
    pressmen: 3,
    checkers: 3,
  });
  const [done, setDone] = useState(false);

  // Order/Target fields (Phase 11)
  const [orderQty, setOrderQty] = useState<number>(0);
  const [plannedStartDate, setPlannedStartDate] = useState(TODAY);
  const [sewingEndDate, setSewingEndDate] = useState("");
  const weeklyOff = useApp((s) => s.weeklyOff);
  const holidays = useApp((s) => s.holidays);
  const plannedWorkingDays = useMemo(() => {
    if (!plannedStartDate || !sewingEndDate || sewingEndDate < plannedStartDate) return 0;
    return countWorkingDays(plannedStartDate, sewingEndDate, weeklyOff, holidays.map((h) => h.date));
  }, [plannedStartDate, sewingEndDate, weeklyOff, holidays]);
  const autoPlannedTarget = plannedWorkingDays > 0 && orderQty > 0 ? Math.round(orderQty / plannedWorkingDays) : 0;

  // History Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "running" | "replaced">("all");

  // Parameter Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportingLineStyle, setReportingLineStyle] = useState<LineStyle | null>(null);
  const [editCmLateral, setEditCmLateral] = useState<number>(100);
  const [editSmv, setEditSmv] = useState<number>(14);
  const [editWfBreakdown, setEditWfBreakdown] = useState({
    operators: 24,
    helpers: 6,
    pressmen: 3,
    checkers: 3,
  });

  const plannedTotal = wfBreakdown.operators + wfBreakdown.helpers + wfBreakdown.pressmen + wfBreakdown.checkers;

  // Try to match typed text to an existing style (by code or name, case-insensitive)
  const matchedStyle = useMemo(() => {
    const q = styleText.trim().toLowerCase();
    if (!q) return undefined;
    return styles.find((s) => s.code.toLowerCase() === q || s.name.toLowerCase() === q || `${s.code} ${s.name}`.toLowerCase().includes(q));
  }, [styleText, styles]);

  const submit = () => {
    let sid = matchedStyle?.id;
    if (!sid) {
      // No existing style matched → create a new style entry in the store.
      // In Supabase mode, this will be persisted via the sync_load_style RPC
      // (which creates the style if needed) or a separate style-creation call.
      // For now, use the text as both code and name.
      const newId = `style-${Date.now()}`;
      sid = newId;
      // Add to local store so it's available immediately.
      const newStyle = { id: newId, code: styleText.trim(), name: styleText.trim(), valuePerPcUsd: 0 };
      useApp.setState((s) => ({ styles: [...s.styles, newStyle] }));
    }
    const cmUsd = cmLocal / (fxRates[currency] ?? 1);
    loadStyle({
      id: `ls-${lineId}-${Date.now()}`,
      lineId,
      styleId: sid,
      cmPerPcUsd: cmUsd,
      smv,
      plannedWorkforce: wfBreakdown,
      loadedAt: new Date().toISOString(),
      orderQty: orderQty > 0 ? orderQty : undefined,
      plannedStartDate: plannedStartDate || undefined,
      sewingEndDate: sewingEndDate || undefined,
    });
    setDone(true);
    setStyleText("");
    setTimeout(() => setDone(false), 1600);
  };

  const startEdit = (
    lsId: string,
    currentCmUsd: number,
    currentSmv: number,
    currentWf?: LineStyle["plannedWorkforce"]
  ) => {
    const rate = fxRates[currency] ?? 1;
    setEditingId(lsId);
    setEditCmLateral(Math.round(currentCmUsd * rate * 100) / 100);
    setEditSmv(currentSmv);

    if (currentWf && typeof currentWf === "object") {
      setEditWfBreakdown({ ...currentWf });
    } else if (typeof currentWf === "number") {
      setEditWfBreakdown({ operators: Math.max(0, currentWf - 12), helpers: 6, pressmen: 3, checkers: 3 });
    } else {
      setEditWfBreakdown({ operators: 24, helpers: 6, pressmen: 3, checkers: 3 });
    }
  };

  const saveCorrection = (lsId: string) => {
    const rate = fxRates[currency] ?? 1;
    const cmUsd = editCmLateral / rate;
    updateLineStyleParams(lsId, {
      cmPerPcUsd: cmUsd,
      smv: editSmv,
      plannedWorkforce: editWfBreakdown,
    });
    setEditingId(null);
  };

  // Filter history to lines owned by this chief + search query + status filter
  const myHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return lineStyles
      .filter((ls) => user.lineIds.includes(ls.lineId))
      .filter((ls) => {
        const lName = lineName(ls.lineId, lang).toLowerCase();
        const style = styles.find((s) => s.id === ls.styleId);
        const sCode = style ? style.code.toLowerCase() : "";
        const sName = style ? style.name.toLowerCase() : "";
        const matchesQuery = !query || lName.includes(query) || sCode.includes(query) || sName.includes(query);

        const isRunning = !ls.unloadedAt;
        const matchesStatus =
          filterStatus === "all"
            ? true
            : filterStatus === "running"
              ? isRunning
              : !isRunning;

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime());
  }, [lineStyles, user.lineIds, lang, searchQuery, filterStatus]);

  const field = "w-full glass-1 rounded-xl px-3 py-3 text-ink outline-none focus:ring-2 focus:ring-brand";

  if (subView === "history") {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSubView("load")}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline glass-1 px-3.5 py-1.5 rounded-full border border-brand/20 active:scale-95 transition"
          >
            <ArrowLeft size={16} />
            <span>{t("common.back")}</span>
          </button>

          <span className="text-xs font-semibold text-ink-muted">
            {myHistory.length} {myHistory.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink">{t("chief.styleHistory")}</h1>
          <p className="text-xs text-ink-muted">Past and active style assignments across your lines</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by line, style code, or style name..."
            className="w-full glass-1 bg-white/90 border border-brand/20 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "all" ? "bg-brand text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            All History
          </button>
          <button
            onClick={() => setFilterStatus("running")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "running" ? "bg-state-success text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            Currently Running
          </button>
          <button
            onClick={() => setFilterStatus("replaced")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "replaced" ? "bg-slate-700 text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            Completed Styles
          </button>
        </div>

        {/* History List Cards */}
        {myHistory.length === 0 ? (
          <GlassCard level={2} className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-ink-muted">{t("chief.noHistory")}</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-brand underline font-medium"
              >
                Clear Search Filter
              </button>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {myHistory.map((ls) => {
              const style = styles.find((s) => s.id === ls.styleId);
              const isRunning = !ls.unloadedAt;
              const isEditing = editingId === ls.id;

              return (
                <GlassCard
                  key={ls.id}
                  level={2}
                  className={`p-4 transition ${
                    isRunning ? "border-2 border-brand/40 bg-white/95 shadow-md" : "opacity-90"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-ink">{lineName(ls.lineId, lang)}</span>
                        {isRunning ? (
                          <span className="text-xs bg-state-success/15 text-state-success font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-state-success animate-pulse" />
                            {t("chief.running")}
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-200 text-slate-600 font-medium px-2.5 py-0.5 rounded-full">
                            {t("chief.replaced")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brand font-semibold mt-0.5">
                        {style ? `${style.code} · ${style.name}` : ls.styleId}
                      </p>
                    </div>

                    {/* Action Buttons: Direct Print Report & Edit Parameters */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        onClick={() => setReportingLineStyle(ls)}
                        className="text-xs bg-slate-800 hover:bg-black text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                        title="Print Clean Black & White Performance Report PDF"
                      >
                        <Printer size={13} />
                        <span>Print Report</span>
                      </button>

                      {isRunning && !isEditing && (
                        ls.editedOnce ? (
                          <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-xl border border-amber-200 shrink-0">
                            {t("chief.editedOnce")}
                          </span>
                        ) : (
                          <button
                            onClick={() => startEdit(ls.id, ls.cmPerPcUsd, ls.smv, ls.plannedWorkforce)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1 border border-slate-200 active:scale-95 shadow-sm shrink-0"
                          >
                            <Edit2 size={13} />
                            <span>{t("chief.editParams")}</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Inline Parameter Editing Form */}
                  {isEditing ? (
                    <div className="mt-3 p-3.5 bg-brand-100/60 rounded-2xl border border-brand/40 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-brand-700">Param Correction (One-Time Edit)</p>
                        <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-medium">1 Edit Allowed</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-ink-muted font-medium">CM / pc ({currency})</label>
                          <input
                            type="number"
                            value={editCmLateral}
                            onChange={(e) => setEditCmLateral(Number(e.target.value))}
                            className="w-full bg-white border border-brand/30 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-brand"
                            inputMode="decimal"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-muted font-medium">SMV (min)</label>
                          <input
                            type="number"
                            value={editSmv}
                            onChange={(e) => setEditSmv(Number(e.target.value))}
                            className="w-full bg-white border border-brand/30 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-brand"
                            inputMode="decimal"
                          />
                        </div>
                      </div>

                      {/* Class-wise Planned Workforce Steppers in Edit Mode */}
                      <div className="space-y-1.5 pt-1 border-t border-brand/20">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-brand-800">Edit Planned Workforce</label>
                          <span className="text-[11px] font-bold text-brand bg-white px-2 py-0.5 rounded-full border border-brand/20">
                            {editWfBreakdown.operators + editWfBreakdown.helpers + editWfBreakdown.pressmen + editWfBreakdown.checkers} total
                          </span>
                        </div>
                        <div className="bg-white/90 rounded-2xl px-3 divide-y divide-slate-100 border border-brand/20">
                          <Stepper
                            label={t("attendance.operators")}
                            value={editWfBreakdown.operators}
                            onChange={(x) => setEditWfBreakdown({ ...editWfBreakdown, operators: Math.max(0, x) })}
                          />
                          <Stepper
                            label={t("attendance.helpers")}
                            value={editWfBreakdown.helpers}
                            onChange={(x) => setEditWfBreakdown({ ...editWfBreakdown, helpers: Math.max(0, x) })}
                          />
                          <Stepper
                            label={t("attendance.pressmen")}
                            value={editWfBreakdown.pressmen}
                            onChange={(x) => setEditWfBreakdown({ ...editWfBreakdown, pressmen: Math.max(0, x) })}
                          />
                          <Stepper
                            label={t("attendance.checkers")}
                            value={editWfBreakdown.checkers}
                            onChange={(x) => setEditWfBreakdown({ ...editWfBreakdown, checkers: Math.max(0, x) })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveCorrection(ls.id)}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-brand text-white shadow-md hover:bg-brand-600 active:scale-95"
                        >
                          {t("chief.saveCorrection")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs bg-white/80 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">CM / Piece</span>
                        <span className="font-bold text-sm text-ink">
                          {money(ls.cmPerPcUsd, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">SMV</span>
                        <span className="font-bold text-sm text-ink">{ls.smv} min</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">Planned WF</span>
                        <span className="font-bold text-sm text-brand">
                          {typeof ls.plannedWorkforce === "number"
                            ? ls.plannedWorkforce
                            : ls.plannedWorkforce
                              ? ls.plannedWorkforce.operators + ls.plannedWorkforce.helpers + ls.plannedWorkforce.pressmen + ls.plannedWorkforce.checkers
                              : 36}
                        </span>
                        <span className="block text-[9px] text-ink-muted mt-0.5 font-medium leading-tight">
                          {typeof ls.plannedWorkforce === "object" && ls.plannedWorkforce
                            ? `${ls.plannedWorkforce.operators} Op · ${ls.plannedWorkforce.helpers} Hlp · ${ls.plannedWorkforce.pressmen} Prs · ${ls.plannedWorkforce.checkers} Chk`
                            : "24 Op · 6 Hlp · 3 Prs · 3 Chk"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-[11px] text-ink-muted flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-brand" />
                      Loaded: {new Date(ls.loadedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {ls.unloadedAt && (
                      <span>
                        Completed: {new Date(ls.unloadedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Direct Printable Style Report Sheet */}
        {reportingLineStyle && (
          <PrintableStyleSheet
            lineStyle={reportingLineStyle}
            onDone={() => setReportingLineStyle(null)}
          />
        )}
      </div>
    );
  }

  // Load Style Form View (subView === "load")
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header with small History button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t("chief.loadTitle")}</h1>
        <button
          onClick={() => setSubView("history")}
          className="glass-1 hover:bg-brand hover:text-white transition text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-brand-700 border border-brand/20 active:scale-95 shadow-sm"
        >
          <History size={14} />
          <span>{t("chief.history")}</span>
        </button>
      </div>

      {/* Main Load Style Form */}
      <GlassCard level="solid" hairline className="p-4 space-y-4">
        {/* Cascading Unit → Floor → Line dropdowns (same row, themed) */}
        <div>
          <label className="text-xs font-medium text-ink-muted mb-1.5 block">{t("chief.pickLine")}</label>
          <LineSelector lineId={lineId} onChange={setLineId} />
        </div>

        {/* Style: text input (type style code or name; no fixed dropdown) */}
        <div>
          <label className="text-xs font-medium text-ink-muted mb-1 block">{t("chief.pickStyle")}</label>
          <input
            type="text"
            value={styleText}
            onChange={(e) => setStyleText(e.target.value)}
            placeholder="Type style code or name (e.g. PL-2201 Basic Polo)"
            className="w-full bg-white border border-brand/20 rounded-2xl px-4 py-3 text-xs font-semibold text-ink shadow-sm outline-none focus:ring-2 focus:ring-brand hover:border-brand/40 transition"
          />
          {matchedStyle && (
            <span className="text-[11px] text-state-success font-medium mt-1 block px-1">
              Matched: {matchedStyle.code} · {matchedStyle.name} (Value: {money(matchedStyle.valuePerPcUsd, currency)}/pc)
            </span>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-ink-muted">{t("chief.cmPerPc")}</label>
          <input
            type="number"
            value={cmLocal}
            onChange={(e) => setCmLocal(Number(e.target.value))}
            className={field}
            inputMode="decimal"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-muted">{t("chief.smv")}</label>
          <input
            type="number"
            value={smv}
            onChange={(e) => setSmv(Number(e.target.value))}
            className={field}
            inputMode="decimal"
          />
        </div>

        {/* Order & Target Fields (Phase 11) */}
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">📦 Order & Delivery Target</label>
          <div>
            <label className="text-xs font-medium text-ink-muted">Order Quantity (pcs)</label>
            <input
              type="number"
              value={orderQty || ""}
              onChange={(e) => setOrderQty(Number(e.target.value))}
              placeholder="e.g. 50000"
              className={field}
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted">Planned Start Date</label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">Sewing End Date</label>
              <input
                type="date"
                value={sewingEndDate}
                onChange={(e) => setSewingEndDate(e.target.value)}
                className={field}
              />
            </div>
          </div>
          {plannedWorkingDays > 0 && (
            <div className="bg-brand-100/40 border border-brand/20 rounded-xl p-2.5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-ink-muted">Working Days:</span><span className="font-bold text-ink">{plannedWorkingDays} days</span></div>
              {autoPlannedTarget > 0 && <div className="flex justify-between"><span className="text-ink-muted">Planned Target:</span><span className="font-bold text-brand">{autoPlannedTarget.toLocaleString()} pcs/day</span></div>}
            </div>
          )}
        </div>

        {/* Planned Workforce Breakdown (Operators, Helpers, Pressmen, Checkers) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink">{t("chief.plannedWorkforce")}</label>
            <span className="text-xs font-bold text-brand bg-brand-100/60 px-2.5 py-0.5 rounded-full">
              {plannedTotal} {t("attendance.total")}
            </span>
          </div>

          <div className="glass-solid rounded-2xl px-4 divide-y divide-ink/5 border border-slate-100">
            <Stepper
              label={t("attendance.operators")}
              value={wfBreakdown.operators}
              onChange={(x) => setWfBreakdown({ ...wfBreakdown, operators: Math.max(0, x) })}
            />
            <Stepper
              label={t("attendance.helpers")}
              value={wfBreakdown.helpers}
              onChange={(x) => setWfBreakdown({ ...wfBreakdown, helpers: Math.max(0, x) })}
            />
            <Stepper
              label={t("attendance.pressmen")}
              value={wfBreakdown.pressmen}
              onChange={(x) => setWfBreakdown({ ...wfBreakdown, pressmen: Math.max(0, x) })}
            />
            <Stepper
              label={t("attendance.checkers")}
              value={wfBreakdown.checkers}
              onChange={(x) => setWfBreakdown({ ...wfBreakdown, checkers: Math.max(0, x) })}
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!styleText.trim() || !lineId}
          className={`w-full font-semibold rounded-2xl py-3.5 transition active:scale-[0.98] shadow-glass flex items-center justify-center gap-2 disabled:opacity-50 ${
            done ? "bg-state-success text-white" : "bg-brand text-white"
          }`}
        >
          {done ? (
            <>
              <Check size={20} /> {t("chief.loaded")}
            </>
          ) : (
            t("chief.load")
          )}
        </button>
      </GlassCard>

      <p className="text-xs text-ink-muted px-1">
        {t("common.today")}: {TODAY}
      </p>

      {/* Direct Printable Style Report Sheet */}
      {reportingLineStyle && (
        <PrintableStyleSheet
          lineStyle={reportingLineStyle}
          onDone={() => setReportingLineStyle(null)}
        />
      )}
    </div>
  );
}
