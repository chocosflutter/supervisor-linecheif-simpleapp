import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useApp } from "@/store/appStore";
import { TODAY } from "@/lib/today";
import { emptyKpis, statusFor } from "@/lib/kpi";
import type { Kpis } from "@/lib/kpi";
import { useKpisByGroup } from "@/hooks/useRepo";
import { floorName, lineName, unitName } from "@/lib/names";
import { money } from "@/lib/format";
import type { KpiKey } from "@/types";
import KpiGrid from "@/components/KpiGrid";
import GlassCard from "@/components/GlassCard";
import DateRangePicker, { type DatePreset } from "@/components/DateRangePicker";

type Level = "factory" | "unit" | "floor" | "line";
interface Path {
  level: Level;
  unitId?: string;
  floorId?: string;
  lineId?: string;
}

const STATUS_HEX = { success: "#12B886", warning: "#E8A317", danger: "#E5484D" } as const;

function linesUnder(path: Path, allLines: { id: string; floorId: string }[], allFloors: { id: string; unitId: string }[]): string[] {
  if (path.level === "line" && path.lineId) return [path.lineId];
  if (path.level === "floor" && path.floorId) return allLines.filter((l) => l.floorId === path.floorId).map((l) => l.id);
  if (path.level === "unit" && path.unitId) {
    const fids = allFloors.filter((f) => f.unitId === path.unitId).map((f) => f.id);
    return allLines.filter((l) => fids.includes(l.floorId)).map((l) => l.id);
  }
  return allLines.map((l) => l.id);
}

export default function PerformanceExplorer() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const ds = useApp((s) => s.dataset());
  const currency = useApp((s) => s.settings.displayCurrency);
  const fxRates = useApp((s) => s.fxRates);
  const rate = fxRates[currency] ?? 1;
  const thresholds = useApp((s) => s.settings.thresholds);
  const lineStyles = useApp((s) => s.lineStyles);
  const lines = useApp((s) => s.lines);
  const floors = useApp((s) => s.floors);
  const units = useApp((s) => s.units);

  const [path, setPath] = useState<Path>({ level: "factory" });
  const [openDropdown, setOpenDropdown] = useState<"unit" | "floor" | "line" | "kpi" | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>("efficiency");

  // Date Range State
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState<string>(TODAY);
  const [endDate, setEndDate] = useState<string>(TODAY);

  // Line Drilldown View Mode: "overall" vs "style"
  const [lineViewMode, setLineViewMode] = useState<"overall" | "style">("overall");

  const activeLines = linesUnder(path, lines, floors);

  // Available options for current context
  const availableFloors = useMemo(() => {
    if (!path.unitId) return [];
    return floors.filter((f) => f.unitId === path.unitId);
  }, [path.unitId, floors]);

  const availableLines = useMemo(() => {
    if (!path.floorId) return [];
    return lines.filter((l) => l.floorId === path.floorId);
  }, [path.floorId, lines]);

  // Comparison chart data for sub-entities
  const children = useMemo(() => {
    if (path.level === "factory")
      return units.map((u) => ({ id: u.id, name: unitName(u.id, lang), lineIds: linesUnder({ level: "unit", unitId: u.id }, lines, floors) }));
    if (path.level === "unit")
      return availableFloors.map((f) => ({ id: f.id, name: floorName(f.id, lang), lineIds: linesUnder({ level: "floor", floorId: f.id }, lines, floors) }));
    if (path.level === "floor")
      return availableLines.map((l) => ({ id: l.id, name: lineName(l.id, lang), lineIds: [l.id] }));
    return [];
  }, [path, availableFloors, availableLines, lang, lines, floors, units]);

  const currentTh = thresholds.find((x) => x.kpi === selectedKpi);

  // One batched call for all sibling groups (no per-child N+1).
  const groups = useMemo(() => children.map((c) => ({ id: c.id, lineIds: c.lineIds })), [children]);
  const { data: kpiByGroup = {} } = useKpisByGroup(groups, { datePreset: "today" });

  const getMetricInfo = (k: Kpis) => {
    switch (selectedKpi) {
      case "productivity":
        return { val: Math.round(k.productivityUsd * rate * 10) / 10, raw: k.productivityUsd, isMoney: true };
      case "cost":
        return { val: Math.round(k.perPieceCostUsd * rate * 100) / 100, raw: k.perPieceCostUsd, isMoney: true };
      case "profit":
        return { val: Math.round(k.netProfitUsd * rate), raw: k.netProfitUsd, isMoney: true };
      case "changeover":
        return { val: Math.round(k.changeoverAvgMin), raw: k.changeoverAvgMin, isMin: true };
      case "defective":
        return { val: Math.round(k.defectivePct * 10) / 10, raw: k.defectivePct, isPct: true };
      case "absenteeism":
        return { val: Math.round(k.absenteeismPct * 10) / 10, raw: k.absenteeismPct, isPct: true };
      case "efficiency":
      default:
        return { val: Math.round(k.efficiency * 10) / 10, raw: k.efficiency, isPct: true };
    }
  };

  const chartData = children.map((c) => {
    const k = kpiByGroup[c.id] ?? emptyKpis();
    const info = getMetricInfo(k);
    const status = statusFor(info.raw, currentTh);
    return {
      name: c.name.replace(/[^0-9]/g, "") || c.name,
      val: info.val,
      status,
      isMoney: info.isMoney,
      isMin: info.isMin,
    };
  });

  const kpiList: KpiKey[] = ["efficiency", "productivity", "cost", "profit", "changeover", "defective", "dhu", "absenteeism"];

  return (
    <div className="space-y-4">
      {/* Click-outside backdrop for open dropdowns */}
      {openDropdown && (
        <div className="fixed inset-0 z-20" onClick={() => setOpenDropdown(null)} />
      )}

      {/* Interactive Dropdown Selector Pills Bar */}
      <div className="flex items-center gap-1.5 flex-wrap relative z-30">
        {/* 1. Unit / Factory Selector Pill */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "unit" ? null : "unit")}
            className={`text-xs font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 transition ${
              !path.unitId ? "bg-brand text-white shadow-md font-semibold" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            <span>{path.unitId ? unitName(path.unitId, lang) : t("explorer.factory")}</span>
            <ChevronDown size={13} className={`transition-transform ${openDropdown === "unit" ? "rotate-180" : ""}`} />
          </button>

          {openDropdown === "unit" && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-50">
              <button
                onClick={() => {
                  setPath({ level: "factory" });
                  setOpenDropdown(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                  path.level === "factory" ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span>{t("explorer.factory")}</span>
                {path.level === "factory" && <Check size={14} className="text-white" />}
              </button>

              {units.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setPath({ level: "unit", unitId: u.id });
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                    path.unitId === u.id && path.level === "unit"
                      ? "bg-brand text-white font-bold"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span>{unitName(u.id, lang)}</span>
                  {path.unitId === u.id && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Floor Selector Pill (shown when a Unit is selected) */}
        {path.unitId && (
          <>
            <ChevronRight size={13} className="text-ink-muted/60" />
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "floor" ? null : "floor")}
                className={`text-xs font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 transition ${
                  path.floorId && !path.lineId
                    ? "bg-brand text-white shadow-md font-semibold"
                    : "glass-1 text-ink-muted hover:text-ink"
                }`}
              >
                <span>{path.floorId ? floorName(path.floorId, lang) : "All Floors"}</span>
                <ChevronDown size={13} className={`transition-transform ${openDropdown === "floor" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "floor" && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-50">
                  <button
                    onClick={() => {
                      setPath({ level: "unit", unitId: path.unitId });
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                      !path.floorId ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <span>All Floors</span>
                    {!path.floorId && <Check size={14} className="text-white" />}
                  </button>

                  {availableFloors.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setPath({ level: "floor", unitId: path.unitId, floorId: f.id });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                        path.floorId === f.id
                          ? "bg-brand text-white font-bold"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>{floorName(f.id, lang)}</span>
                      {path.floorId === f.id && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* 3. Line Selector Pill (shown when a Floor is selected) */}
        {path.floorId && (
          <>
            <ChevronRight size={13} className="text-ink-muted/60" />
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "line" ? null : "line")}
                className={`text-xs font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 transition ${
                  path.lineId ? "bg-brand text-white shadow-md font-semibold" : "glass-1 text-ink-muted hover:text-ink"
                }`}
              >
                <span>{path.lineId ? lineName(path.lineId, lang) : "All Lines"}</span>
                <ChevronDown size={13} className={`transition-transform ${openDropdown === "line" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "line" && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-50">
                  <button
                    onClick={() => {
                      setPath({ level: "floor", unitId: path.unitId, floorId: path.floorId });
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                      !path.lineId ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <span>All Lines</span>
                    {!path.lineId && <Check size={14} className="text-white" />}
                  </button>

                  {availableLines.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setPath({ level: "line", unitId: path.unitId, floorId: path.floorId, lineId: l.id });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                        path.lineId === l.id
                          ? "bg-brand text-white font-bold"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>{lineName(l.id, lang)}</span>
                      {path.lineId === l.id && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. Permanent Dedicated Row for Date Range Filter */}
      <div className="relative z-20">
        <DateRangePicker
          preset={datePreset}
          startDate={startDate}
          endDate={endDate}
          onChange={(p, s, e) => {
            setDatePreset(p);
            setStartDate(s);
            setEndDate(e);
          }}
        />
      </div>

      {/* When an individual line is selected: Interactive Toggle for Overall Line Performance vs Style Specific Data */}
      {path.lineId && (() => {
        const activeLsForLine = lineStyles.find((x) => x.lineId === path.lineId && !x.unloadedAt && x.status !== "closed" && x.status !== "queued");
        const activeStyleForLine = activeLsForLine ? ds.styles.find((s) => s.id === activeLsForLine.styleId) : null;

        return (
          <div className="flex items-center gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 animate-fadeIn">
            <button
              onClick={() => setLineViewMode("overall")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                lineViewMode === "overall"
                  ? "bg-brand text-white shadow-sm font-extrabold"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              Line Overall Performance
            </button>
            <button
              onClick={() => setLineViewMode("style")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                lineViewMode === "style"
                  ? "bg-brand text-white shadow-sm font-extrabold"
                  : "bg-brand-100/70 text-brand-700 hover:bg-brand-100"
              }`}
            >
              <span>
                👕 Style: {activeStyleForLine ? `${activeStyleForLine.code} (${activeStyleForLine.name})` : "No Active Style"}
              </span>
            </button>
          </div>
        );
      })()}

      {/* KPI Cards Grid */}
      <KpiGrid
        lineIds={activeLines}
        showProfit
        datePreset={datePreset}
        startDate={startDate}
        endDate={endDate}
        filterStyleId={
          path.lineId && lineViewMode === "style"
            ? lineStyles.find((x) => x.lineId === path.lineId && !x.unloadedAt && x.status !== "closed" && x.status !== "queued")?.styleId
            : undefined
        }
      />

      {/* Sub-entity Comparison Chart with Standard App Dropdown Pill Popover */}
      {chartData.length > 0 && (
        <GlassCard level={2} className="p-4 relative z-30">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-bold text-ink">Comparison</span>

            {/* Standard App Pill Dropdown Selector */}
            <div className="relative z-40">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === "kpi" ? null : "kpi");
                }}
                className="text-xs font-semibold rounded-full px-3.5 py-1.5 flex items-center gap-1.5 bg-brand text-white shadow-md transition active:scale-[0.98] cursor-pointer"
              >
                <span>{t(`kpi.${selectedKpi}`)}</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${openDropdown === "kpi" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "kpi" && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-1.5 w-44 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-[100]"
                >
                  {kpiList.map((kpiKey) => (
                    <button
                      key={kpiKey}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKpi(kpiKey);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium cursor-pointer transition ${
                        selectedKpi === kpiKey ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>{t(`kpi.${kpiKey}`)}</span>
                      {selectedKpi === kpiKey && <Check size={14} className="text-white font-bold" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 22, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(126,111,177,0.12)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6A6386" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(126,111,177,0.2)" }}
                  formatter={(v: number, _name: string, props: any) => {
                    const isMoney = props?.payload?.isMoney;
                    const isMin = props?.payload?.isMin || selectedKpi === "changeover";
                    const formatted = isMoney ? money(v / rate, currency) : isMin ? `${v} min` : `${v}%`;
                    return [formatted, t(`kpi.${selectedKpi}`)];
                  }}
                />
                <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                  <LabelList
                    dataKey="val"
                    position="top"
                    formatter={(v: number) => {
                      const isMoney = ["productivity", "cost", "profit"].includes(selectedKpi);
                      const isMin = selectedKpi === "changeover";
                      return isMoney ? money(v / rate, currency) : isMin ? `${v}m` : `${v}%`;
                    }}
                    style={{ fontSize: 11, fontWeight: 700, fill: "#332A54" }}
                  />
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={STATUS_HEX[d.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
