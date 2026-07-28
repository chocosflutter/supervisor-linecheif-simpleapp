import { useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { LineStyle } from "@/types";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import { money, num } from "@/lib/format";

interface PrintableStyleSheetProps {
  lineStyle: LineStyle;
  onDone: () => void;
}

export default function PrintableStyleSheet({ lineStyle, onDone }: PrintableStyleSheetProps) {
  const lang = useApp((s) => s.lang);
  const currency = useApp((s) => s.settings.displayCurrency);
  const production = useApp((s) => s.production);
  const styles = useApp((s) => s.styles);

  const style = styles.find((s) => s.id === lineStyle.styleId);
  const lineTitle = lineName(lineStyle.lineId, lang);
  const styleCode = style?.code || lineStyle.styleId;
  const styleName = style?.name || "";

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

  // Day-wise data from actual production (store is hydrated from DB in supabase mode).
  // Only shows days with real entries — no fake/mock data.
  const daywiseData = useMemo(() => {
    const dayMap = new Map<string, { good: number; defective: number; defects: number }>();
    production
      .filter((p) => p.lineId === lineStyle.lineId && p.styleId === lineStyle.styleId)
      .forEach((p) => {
        const prev = dayMap.get(p.date) ?? { good: 0, defective: 0, defects: 0 };
        dayMap.set(p.date, {
          good: prev.good + p.goodQty,
          defective: prev.defective + p.defectivePcs,
          defects: prev.defects + p.totalDefects,
        });
      });

    return [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, d], idx) => {
        const inspectedPcs = d.good + d.defective;
        const eff = plannedWfCount > 0 && lineStyle.smv > 0
          ? Math.round((inspectedPcs * lineStyle.smv) / (60 * plannedWfCount) * 100)
          : 0;
        const dhu = inspectedPcs > 0 ? Math.round((d.defects * 100 / inspectedPcs) * 10) / 10 : 0;
        const defRate = inspectedPcs > 0 ? Math.round((d.defective / inspectedPcs) * 1000) / 10 : 0;
        const cmEarnedUsd = d.good * lineStyle.cmPerPcUsd;
        return {
          dayNum: idx + 1,
          date: dateStr,
          goodQty: d.good,
          inspectedPcs,
          efficiency: eff,
          dhu,
          defectRate: defRate,
          cmEarnedUsd,
        };
      });
  }, [production, lineStyle, plannedWfCount]);

  const totals = useMemo(() => {
    if (daywiseData.length === 0) return { totalGood: 0, totalInspected: 0, avgEff: 0, avgDhu: "0.0", avgDefRate: "0.0", totalCmUsd: 0 };
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

  // Trigger print directly on mount & clean up
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
      onDone();
    }, 100);

    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div className="print-report-sheet hidden print:block fixed inset-0 z-[999999] bg-white text-black p-8 font-sans">
      {/* Document Header */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">
              RBC LINE PERFORMANCE ANALYTICS
            </h1>
            <h2 className="text-base font-semibold text-black mt-0.5">
              STYLE PERFORMANCE REPORT
            </h2>
          </div>
          <div className="text-right text-xs text-black">
            <p><strong>Report Date:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>Status:</strong> {lineStyle.unloadedAt ? "COMPLETED" : "ACTIVE RUNNING"}</p>
          </div>
        </div>
      </div>

      {/* Style Details Summary Table */}
      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-black">
          1. STYLE & LINE SPECIFICATIONS
        </h3>
        <table className="w-full text-xs border-collapse border border-black text-black">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100 w-1/4">Production Line</td>
              <td className="border border-black p-2 w-1/4">{lineTitle}</td>
              <td className="border border-black p-2 font-bold bg-gray-100 w-1/4">Style Code</td>
              <td className="border border-black p-2 w-1/4">{styleCode}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100">Style Name</td>
              <td className="border border-black p-2">{styleName}</td>
              <td className="border border-black p-2 font-bold bg-gray-100">Loaded Date</td>
              <td className="border border-black p-2">{new Date(lineStyle.loadedAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100">Garment SMV</td>
              <td className="border border-black p-2">{lineStyle.smv} Minutes</td>
              <td className="border border-black p-2 font-bold bg-gray-100">CM Rate / Piece</td>
              <td className="border border-black p-2">{money(lineStyle.cmPerPcUsd, currency)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100">Planned plannedWfCount</td>
              <td className="border border-black p-2">{plannedWfCount} Workers</td>
              <td className="border border-black p-2 font-bold bg-gray-100">Total Style Output</td>
              <td className="border border-black p-2 font-bold">{num(totals.totalGood)} Pcs</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Overall KPI Summary Table */}
      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-black">
          2. OVERALL KPI PERFORMANCE SUMMARY
        </h3>
        <table className="w-full text-xs border-collapse border border-black text-black">
          <thead>
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black p-2 text-left">AVERAGE LINE EFFICIENCY</th>
              <th className="border border-black p-2 text-left">TOTAL CM REVENUE EARNED</th>
              <th className="border border-black p-2 text-left">AVERAGE DHU %</th>
              <th className="border border-black p-2 text-left">AVERAGE DEFECT RATE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2.5 font-bold text-sm">{totals.avgEff}%</td>
              <td className="border border-black p-2.5 font-bold text-sm">{money(totals.totalCmUsd, currency)}</td>
              <td className="border border-black p-2.5 font-bold text-sm">{totals.avgDhu}%</td>
              <td className="border border-black p-2.5 font-bold text-sm">{totals.avgDefRate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Daywise KPI Table */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-black">
          3. DAYWISE KPI TREND BREAKDOWN
        </h3>
        <table className="w-full text-xs border-collapse border border-black text-black">
          <thead>
            <tr className="bg-gray-100 font-bold uppercase">
              <th className="border border-black p-2 text-left">DAY</th>
              <th className="border border-black p-2 text-left">DATE</th>
              <th className="border border-black p-2 text-right">GOOD OUTPUT</th>
              <th className="border border-black p-2 text-right">INSPECTED PCS</th>
              <th className="border border-black p-2 text-right">EFFICIENCY (%)</th>
              <th className="border border-black p-2 text-right">DHU (%)</th>
              <th className="border border-black p-2 text-right">DEFECT RATE (%)</th>
              <th className="border border-black p-2 text-right">CM EARNED</th>
            </tr>
          </thead>
          <tbody>
            {daywiseData.map((d) => (
              <tr key={d.dayNum}>
                <td className="border border-black p-2 font-bold">Day {d.dayNum}</td>
                <td className="border border-black p-2">{d.date}</td>
                <td className="border border-black p-2 text-right font-bold">{num(d.goodQty)} pcs</td>
                <td className="border border-black p-2 text-right">{num(d.inspectedPcs)} pcs</td>
                <td className="border border-black p-2 text-right font-bold">{d.efficiency}%</td>
                <td className="border border-black p-2 text-right">{d.dhu}%</td>
                <td className="border border-black p-2 text-right">{d.defectRate}%</td>
                <td className="border border-black p-2 text-right font-bold">{money(d.cmEarnedUsd, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-black">
              <td colSpan={2} className="border border-black p-2 uppercase">TOTAL / OVERALL AVERAGE</td>
              <td className="border border-black p-2 text-right">{num(totals.totalGood)} pcs</td>
              <td className="border border-black p-2 text-right">{num(totals.totalInspected)} pcs</td>
              <td className="border border-black p-2 text-right">{totals.avgEff}%</td>
              <td className="border border-black p-2 text-right">{totals.avgDhu}%</td>
              <td className="border border-black p-2 text-right">{totals.avgDefRate}%</td>
              <td className="border border-black p-2 text-right">{money(totals.totalCmUsd, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Document Footer */}
      <div className="border-t border-black pt-3 flex justify-between items-center text-[10px] text-black">
        <span>RBC Industrial Engineering Management System</span>
        <span>Page 1 of 1 · Verified Performance Document</span>
      </div>
    </div>,
    document.body
  );
}
