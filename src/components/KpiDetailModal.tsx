import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CustomDatePicker from "./CustomDatePicker";
import { useTranslation } from "react-i18next";
import { X, TrendingUp, TrendingDown, Activity, BarChart2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KpiKey, KpiStatus } from "@/types";
import { useDailyTrend } from "@/hooks/useRepo";
import { TODAY } from "@/lib/today";

interface KpiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiKey: KpiKey;
  title: string;
  value: string;
  subtitle?: string;
  status?: KpiStatus;
  spark?: number[];
  lineIds: string[];
  outerDatePreset?: string;
  outerStartDate?: string;
  outerEndDate?: string;
}

type Period = "1D" | "Yesterday" | "1M" | "1Y" | "Custom";

const statusColor: Record<KpiStatus, string> = {
  success: "#12B886",
  warning: "#E8A317",
  danger: "#E5484D",
};

interface DataPoint {
  time: string;
  val: number;
}

function mapPresetToPeriod(preset?: string): Period {
  if (!preset) return "1D";
  if (preset === "today") return "1D";
  if (preset === "yesterday") return "Yesterday";
  if (preset === "last7" || preset === "last30") return "1M";
  if (preset === "custom") return "Custom";
  return "1D";
}

export default function KpiDetailModal({
  isOpen,
  onClose,
  kpiKey,
  title,
  value,
  subtitle,
  status = "success",
  spark = [],
  lineIds,
  outerDatePreset,
  outerStartDate,
  outerEndDate,
}: KpiDetailModalProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(() => mapPresetToPeriod(outerDatePreset));
  const [startDate, setStartDate] = useState<string>(outerStartDate || "2026-07-01");
  const [endDate, setEndDate] = useState<string>(outerEndDate || TODAY);

  // Sync from outer filter when modal opens
  useEffect(() => {
    if (isOpen) {
      setPeriod(mapPresetToPeriod(outerDatePreset));
      if (outerStartDate) setStartDate(outerStartDate);
      if (outerEndDate) setEndDate(outerEndDate);
    }
  }, [isOpen, outerDatePreset, outerStartDate, outerEndDate]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Compute date range for the trend query based on period
  const { trendStart, trendEnd } = useMemo(() => {
    if (period === "1D") return { trendStart: TODAY, trendEnd: TODAY };
    if (period === "Yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yd = y.toISOString().slice(0, 10);
      return { trendStart: yd, trendEnd: yd };
    }
    if (period === "1M") {
      const d = new Date(); d.setDate(d.getDate() - 30);
      return { trendStart: d.toISOString().slice(0, 10), trendEnd: TODAY };
    }
    if (period === "1Y") {
      const d = new Date(); d.setFullYear(d.getFullYear() - 1);
      return { trendStart: d.toISOString().slice(0, 10), trendEnd: TODAY };
    }
    // Custom
    return { trendStart: startDate, trendEnd: endDate };
  }, [period, startDate, endDate]);

  // Fetch daily trend from server (cached in React Query → works offline)
  const { data: dailyTrend = [] } = useDailyTrend(lineIds, trendStart, trendEnd);

  const color = statusColor[status];

  // Build chart data points based on KPI type and period
  const chartData = useMemo<DataPoint[]>(() => {
    // 1D only: use today's hourly spark (produced qty per slot)
    if (period === "1D") {
      if (!spark || spark.length === 0) return [];
      const slots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
      return spark.map((v, i) => ({ time: slots[i] || `${8 + i}:00`, val: Math.round(v * 10) / 10 }));
    }

    // All other periods: derive the KPI metric from daily aggregates
    if (dailyTrend.length === 0) return [];
    return dailyTrend.map((d) => {
      let val = 0;
      const inspected = d.goodQty + d.defectivePcs;
      switch (kpiKey) {
        case "efficiency": {
          // efficiency = produced_minutes / (slots * 60) * 100 — approx capacity utilization
          const capacityMin = d.slots * 60; // each slot = 1 hour
          val = capacityMin > 0 ? Math.round((d.producedMinutes / capacityMin) * 1000) / 10 : 0;
          break;
        }
        case "productivity":
          // CM value per man-hour (produced_minutes as labor-minutes proxy)
          val = d.producedMinutes > 0 ? Math.round((d.cmValueUsd / (d.producedMinutes / 60)) * 100) / 100 : 0;
          break;
        case "cost":
          // Per-piece cost = value_usd / good_qty (uses style value stored in agg)
          val = d.goodQty > 0 ? Math.round((d.valueUsd / d.goodQty) * 100) / 100 : 0;
          break;
        case "profit":
          // Daily CM earned (in USD — will be converted by formatVal)
          val = Math.round(d.cmValueUsd * 100) / 100;
          break;
        case "defective":
          val = inspected > 0 ? Math.round((d.defectivePcs / inspected) * 1000) / 10 : 0;
          break;
        case "dhu":
          val = inspected > 0 ? Math.round((d.totalDefects / inspected) * 1000) / 10 : 0;
          break;
        case "absenteeism":
          val = 0; // no workforce data in daily aggregate
          break;
        case "changeover":
          val = 0; // no changeover data in daily aggregate
          break;
        default:
          val = d.goodQty;
      }
      return { time: d.date.slice(5), val }; // "MM-DD" label
    });
  }, [period, spark, dailyTrend, kpiKey]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { max: 0, min: 0, avg: 0, trendPct: 0 };
    const vals = chartData.map((d) => d.val);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const first = vals[0] || 1;
    const last = vals[vals.length - 1] || 1;
    const trendPct = Math.round(((last - first) / first) * 100);
    return { max, min, avg, trendPct };
  }, [chartData]);

  if (!isOpen) return null;

  const isPercent = value.includes("%");
  const isCurrency = value.includes("$") || value.includes("৳") || value.includes("₹");
  const currencySymbol = value.startsWith("$") ? "$" : value.startsWith("৳") ? "৳" : value.startsWith("₹") ? "₹" : "";

  const formatVal = (v: number) => {
    if (isPercent) return `${v}%`;
    if (isCurrency) return `${currencySymbol}${v.toLocaleString()}`;
    return v.toLocaleString();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl overflow-hidden animate-modal z-10 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ background: color }}>
              <Activity size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{subtitle || t("common.performance")}</span>
              <h2 className="text-xl font-bold text-ink leading-tight">{title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-ink-muted hover:text-ink active:scale-95 transition">
            <X size={18} />
          </button>
        </div>

        {/* Big value */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <div className="text-3xl font-extrabold text-ink tracking-tight">{value}</div>
            <p className="text-xs text-ink-muted mt-0.5">{t("common.today")}</p>
          </div>
          {chartData.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold" style={{ color }}>
              {stats.trendPct >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              <span>{stats.trendPct >= 0 ? `+${stats.trendPct}%` : `${stats.trendPct}%`}</span>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-100/90 p-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-4">
            {(["1D", "Yesterday", "1M", "1Y", "Custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 min-w-[70px] text-center ${
                  period === p ? "bg-brand text-white shadow-md" : "text-ink-muted hover:text-ink hover:bg-white/80"
                }`}
              >
                {p === "1D" ? "1 Day" : p === "Yesterday" ? "Yesterday" : p === "1M" ? "1 Month" : p === "1Y" ? "1 Year" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {period === "Custom" && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 animate-fadeIn">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Select Custom Date Range:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <CustomDatePicker label="From" value={startDate} onChange={setStartDate} />
              <CustomDatePicker label="To" value={endDate} onChange={setEndDate} />
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="p-3 pt-4 rounded-2xl bg-slate-50/90 border border-slate-200/70">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2 px-1">
            <span className="flex items-center gap-1 font-medium">
              <BarChart2 size={14} className="text-brand" />
              {title} Trend ({period === "1D" ? "Hourly" : period === "1Y" ? "1 Year" : period === "1M" ? "30 Days" : period})
            </span>
            <span className="font-mono text-[11px]">{chartData.length} Data Points</span>
          </div>

          {chartData.length === 0 ? (
            <div className="h-56 w-full flex items-center justify-center text-ink-muted text-sm">
              No data yet — enter production to see trends
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`detail-grad-${kpiKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(126,111,177,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6A6386" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6A6386" }} axisLine={false} tickLine={false} tickFormatter={formatVal} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, background: "rgba(255,255,255,0.98)", border: "1px solid rgba(126,111,177,0.25)", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", padding: "8px 12px" }}
                    formatter={(val: number) => [formatVal(val), title]}
                    labelStyle={{ fontWeight: "bold", color: "#241F3A", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="val" stroke={color} strokeWidth={3} fill={`url(#detail-grad-${kpiKey})`} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: color }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stats */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
              <span className="text-[10px] text-ink-muted font-semibold uppercase block">Peak</span>
              <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.max)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
              <span className="text-[10px] text-ink-muted font-semibold uppercase block">Average</span>
              <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.avg)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
              <span className="text-[10px] text-ink-muted font-semibold uppercase block">Lowest</span>
              <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.min)}</span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body!
  );
}
