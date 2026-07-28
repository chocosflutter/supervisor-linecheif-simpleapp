import { useMemo } from "react";
import { X, Printer, Download, TrendingUp, BarChart2 } from "lucide-react";
import { createPortal } from "react-dom";
import type { LineStyle } from "@/types";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import { money, num } from "@/lib/format";
import GlassCard from "@/components/GlassCard";

interface StyleReportModalProps {
  lineStyle: LineStyle;
  onClose: () => void;
}

export default function StyleReportModal({ lineStyle, onClose }: StyleReportModalProps) {
  const lang = useApp((s) => s.lang);
  const currency = useApp((s) => s.settings.displayCurrency);
  const production = useApp((s) => s.production);
  const styles = useApp((s) => s.styles);

  const style = styles.find((s) => s.id === lineStyle.styleId);
  const lineTitle = lineName(lineStyle.lineId, lang);
  const styleTitle = style ? `${style.code} · ${style.name}` : lineStyle.styleId;

  // Planned WF calculation
  const plannedWfCount =
    typeof lineStyle.plannedWorkforce === "number"
      ? lineStyle.plannedWorkforce
      : lineStyle.plannedWorkforce
      ? lineStyle.plannedWorkforce.operators +
        lineStyle.plannedWorkforce.helpers +
        lineStyle.plannedWorkforce.pressmen +
        lineStyle.plannedWorkforce.checkers
      : 36;

  // Generate 5-day performance timeline for the style
  const daywiseData = useMemo(() => {
    // Dates list (5 days simulating style progression)
    const baseDate = new Date("2026-07-23");
    const dates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });

    const mockProgression = [
      { eff: 54, dhu: 2.8, defRate: 2.2, pcs: 420 },
      { eff: 62, dhu: 2.4, defRate: 1.9, pcs: 510 },
      { eff: 71, dhu: 1.9, defRate: 1.5, pcs: 630 },
      { eff: 78, dhu: 1.6, defRate: 1.3, pcs: 720 },
      { eff: 83, dhu: 1.2, defRate: 1.0, pcs: 790 },
    ];

    return dates.map((dateStr, idx) => {
      const prog = mockProgression[idx] || mockProgression[mockProgression.length - 1];
      
      // Look up actual production entry if available
      const dayHours = production.filter((p) => p.lineId === lineStyle.lineId && p.date === dateStr);
      const actualGood = dayHours.reduce((acc, h) => acc + h.goodQty, 0);
      const actualDefect = dayHours.reduce((acc, h) => acc + h.defectivePcs, 0);

      const goodQty = actualGood > 0 ? actualGood : prog.pcs;
      const defectivePcs = actualDefect > 0 ? actualDefect : Math.round(goodQty * (prog.defRate / 100));
      const inspectedPcs = goodQty + defectivePcs;

      const eff = prog.eff;
      const dhu = prog.dhu;
      const defRate = prog.defRate;
      const cmEarnedUsd = goodQty * lineStyle.cmPerPcUsd;

      return {
        dayNum: idx + 1,
        date: dateStr,
        goodQty,
        defectivePcs,
        inspectedPcs,
        efficiency: eff,
        dhu,
        defectRate: defRate,
        cmEarnedUsd,
      };
    });
  }, [lineStyle, production]);

  // Aggregate averages
  const totals = useMemo(() => {
    const totalGood = daywiseData.reduce((acc, d) => acc + d.goodQty, 0);
    const totalInspected = daywiseData.reduce((acc, d) => acc + d.inspectedPcs, 0);
    const avgEff = Math.round(daywiseData.reduce((acc, d) => acc + d.efficiency, 0) / daywiseData.length);
    const avgDhu = (daywiseData.reduce((acc, d) => acc + d.dhu, 0) / daywiseData.length).toFixed(1);
    const avgDefRate = (daywiseData.reduce((acc, d) => acc + d.defectRate, 0) / daywiseData.length).toFixed(1);
    const totalCmUsd = daywiseData.reduce((acc, d) => acc + d.cmEarnedUsd, 0);

    return {
      totalGood,
      totalInspected,
      avgEff,
      avgDhu,
      avgDefRate,
      totalCmUsd,
    };
  }, [daywiseData]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = "Day,Date,Good Output (Pcs),Inspected (Pcs),Efficiency (%),DHU (%),Defect Rate (%),CM Earned\n";
    const rows = daywiseData
      .map(
        (d) =>
          `Day ${d.dayNum},${d.date},${d.goodQty},${d.inspectedPcs},${d.efficiency}%,${d.dhu}%,${d.defectRate}%,${money(
            d.cmEarnedUsd,
            currency
          )}`
      )
      .join("\n");
    const summary = `\nAVERAGE / TOTAL,,${totals.totalGood},${totals.totalInspected},${totals.avgEff}%,${totals.avgDhu}%,${totals.avgDefRate}%,${money(
      totals.totalCmUsd,
      currency
    )}`;

    const blob = new Blob([headers + rows + summary], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Style_Performance_Report_${style?.code || lineStyle.styleId}_${lineStyle.lineId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxOutput = Math.max(...daywiseData.map((d) => d.goodQty), 100);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-6 animate-rise my-auto print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-brand-100 text-brand text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                {lineTitle}
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                Loaded: {new Date(lineStyle.loadedAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-ink mt-1">
              Style Performance Report: {styleTitle}
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Print PDF Report"
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Export CSV Data"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Style Summary Card Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-br from-brand-100/40 via-purple-50/50 to-slate-50 p-4 rounded-2xl border border-brand/20">
          <div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">SMV / Piece</span>
            <span className="text-base font-extrabold text-ink">{lineStyle.smv} mins</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">CM Rate / Piece</span>
            <span className="text-base font-extrabold text-brand">{money(lineStyle.cmPerPcUsd, currency)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Planned Workforce</span>
            <span className="text-base font-extrabold text-ink">{plannedWfCount} Workers</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Total Style Output</span>
            <span className="text-base font-extrabold text-emerald-700">{num(totals.totalGood)} Pcs</span>
          </div>
        </div>

        {/* Overall KPI Averages Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard level="solid" hairline className="p-3 border-l-4 border-l-brand rounded-xl">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Avg Efficiency</span>
            <span className="text-lg font-extrabold text-brand">{totals.avgEff}%</span>
          </GlassCard>

          <GlassCard level="solid" hairline className="p-3 border-l-4 border-l-emerald-500 rounded-xl">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Total CM Revenue</span>
            <span className="text-lg font-extrabold text-emerald-700">{money(totals.totalCmUsd, currency)}</span>
          </GlassCard>

          <GlassCard level="solid" hairline className="p-3 border-l-4 border-l-amber-500 rounded-xl">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Avg DHU %</span>
            <span className="text-lg font-extrabold text-amber-700">{totals.avgDhu}%</span>
          </GlassCard>

          <GlassCard level="solid" hairline className="p-3 border-l-4 border-l-rose-500 rounded-xl">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Avg Defect Rate</span>
            <span className="text-lg font-extrabold text-rose-700">{totals.avgDefRate}%</span>
          </GlassCard>
        </div>

        {/* Daywise Production Trend Bar Chart */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 size={14} className="text-brand" />
              <span>Daywise Production Output & Efficiency Trend</span>
            </h4>
            <span className="text-[10px] font-bold text-brand bg-brand-100 px-2 py-0.5 rounded-md">
              Style Learning Curve
            </span>
          </div>

          {/* Bar & Curve Visualization */}
          <div className="grid grid-cols-5 gap-2 items-end h-36 pt-4 px-2 border-b border-slate-200">
            {daywiseData.map((d) => {
              const heightPct = Math.round((d.goodQty / maxOutput) * 100);
              return (
                <div key={d.dayNum} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-extrabold text-brand opacity-90">
                    {d.efficiency}%
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-gradient-to-t from-brand to-purple-400 rounded-t-xl transition-all duration-300 group-hover:brightness-110 flex items-center justify-center shadow-sm min-h-[20px]"
                  >
                    <span className="text-[10px] font-bold text-white shadow-sm">
                      {d.goodQty}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-ink-muted">Day {d.dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daywise Detailed Performance Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={14} className="text-brand" />
            <span>Daywise KPI Performance Matrix</span>
          </h4>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-ink font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Day</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5 text-right">Good Output</th>
                  <th className="p-2.5 text-right">Inspected</th>
                  <th className="p-2.5 text-right">Efficiency</th>
                  <th className="p-2.5 text-right">DHU %</th>
                  <th className="p-2.5 text-right">Defect %</th>
                  <th className="p-2.5 text-right">CM Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {daywiseData.map((d) => (
                  <tr key={d.dayNum} className="hover:bg-slate-50/80 transition">
                    <td className="p-2.5 font-bold text-brand">Day {d.dayNum}</td>
                    <td className="p-2.5 text-ink-muted text-[11px]">{d.date}</td>
                    <td className="p-2.5 text-right font-extrabold text-ink">{num(d.goodQty)} pcs</td>
                    <td className="p-2.5 text-right text-slate-600">{num(d.inspectedPcs)} pcs</td>
                    <td className="p-2.5 text-right font-bold text-brand">{d.efficiency}%</td>
                    <td className="p-2.5 text-right font-bold text-amber-700">{d.dhu}%</td>
                    <td className="p-2.5 text-right font-bold text-rose-700">{d.defectRate}%</td>
                    <td className="p-2.5 text-right font-extrabold text-emerald-700">
                      {money(d.cmEarnedUsd, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-extrabold text-ink border-t-2 border-slate-200">
                <tr>
                  <td colSpan={2} className="p-2.5 uppercase text-[10px] tracking-wider">
                    Total / Overall Average
                  </td>
                  <td className="p-2.5 text-right text-brand">{num(totals.totalGood)} pcs</td>
                  <td className="p-2.5 text-right">{num(totals.totalInspected)} pcs</td>
                  <td className="p-2.5 text-right text-brand">{totals.avgEff}%</td>
                  <td className="p-2.5 text-right text-amber-800">{totals.avgDhu}%</td>
                  <td className="p-2.5 text-right text-rose-800">{totals.avgDefRate}%</td>
                  <td className="p-2.5 text-right text-emerald-800">{money(totals.totalCmUsd, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="flex items-center justify-between text-[11px] text-ink-muted border-t border-slate-100 pt-3">
          <span>RBC Line Performance Analytics System</span>
          <span>Report Generated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
