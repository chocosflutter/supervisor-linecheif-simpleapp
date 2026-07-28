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

interface KpiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiKey: KpiKey;
  title: string;
  value: string;
  subtitle?: string;
  status?: KpiStatus;
  spark?: number[];
}

type Period = "1D" | "Yesterday" | "1M" | "1Y" | "Style" | "Custom";

const statusColor: Record<KpiStatus, string> = {
  success: "#12B886",
  warning: "#E8A317",
  danger: "#E5484D",
};

interface DataPoint {
  time: string;
  val: number;
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
}: KpiDetailModalProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("1D");
  const [startDate, setStartDate] = useState<string>("2026-07-20");
  const [endDate, setEndDate] = useState<string>("2026-07-27");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const color = statusColor[status];

  // Chart data: derived from the real sparkline (produced qty per slot) when available.
  // Returns empty array (→ "No data" state) when there is no production data.
  const chartData = useMemo<DataPoint[]>(() => {
    if (!spark || spark.length === 0) return [];

    if (period === "1D" || period === "Yesterday") {
      const slots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
      return spark.map((v, i) => ({
        time: slots[i] || `${8 + i}:00`,
        val: Math.round(v * 10) / 10,
      }));
    }

    // For other periods (1M, 1Y, Custom, Style) we don't have historical sparkline
    // data from the server yet — show what we have (today's slots) as a stand-in.
    const slots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
    return spark.map((v, i) => ({
      time: slots[i] || `${8 + i}:00`,
      val: Math.round(v * 10) / 10,
    }));
  }, [period, spark]);

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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card — Solid opaque background for maximum contrast */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl overflow-hidden animate-modal z-10 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md font-bold text-lg"
              style={{ background: color }}
            >
              <Activity size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {subtitle || t("common.performance")}
              </span>
              <h2 className="text-xl font-bold text-ink leading-tight">{title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-ink-muted hover:text-ink active:scale-95 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Big Value & Trend */}
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

        {/* Horizontally Scrollable Period Segmented Pill Filter with Scroll Peek Affordance */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-100/90 p-1.5">
          {/* Subtle gradient right edge fade indicating more content to scroll */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-200/90 to-transparent z-10" />

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-6 scroll-smooth">
            {(["1D", "Yesterday", "1M", "1Y", "Style", "Custom"] as Period[]).map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 min-w-[78px] text-center ${
                    active
                      ? "bg-brand text-white shadow-md scale-[1.02]"
                      : "text-ink-muted hover:text-ink hover:bg-white/80"
                  }`}
                >
                  {p === "1D"
                    ? "1 Day"
                    : p === "Yesterday"
                    ? "Yesterday"
                    : p === "1M"
                    ? "1 Month"
                    : p === "1Y"
                    ? "1 Year"
                    : p === "Style"
                    ? "Running Style"
                    : "Custom Range"}
                </button>
              );
            })}
          </div>
        </div>

        {period === "Style" && (
          <div className="bg-brand-100/70 border border-brand/30 rounded-xl p-2.5 flex items-center justify-between text-xs font-semibold text-brand-700 animate-fadeIn">
            <span className="flex items-center gap-1.5 font-bold">
              <span>👕 Active Running Style: PL-2201 (Basic Polo)</span>
            </span>
            <span className="text-[10px] bg-brand text-white font-extrabold px-2 py-0.5 rounded-md">
              Style Run (5 Days)
            </span>
          </div>
        )}

        {period === "Custom" && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 animate-fadeIn">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Select Custom Date Range:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <CustomDatePicker
                label="From"
                value={startDate}
                onChange={(val) => setStartDate(val)}
              />
              <CustomDatePicker
                label="To"
                value={endDate}
                onChange={(val) => setEndDate(val)}
              />
            </div>
          </div>
        )}

        {/* Big Recharts Detailed Area Chart */}
        <div className="p-3 pt-4 rounded-2xl bg-slate-50/90 border border-slate-200/70">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2 px-1">
            <span className="flex items-center gap-1 font-medium">
              <BarChart2 size={14} className="text-brand" />
              {title} Trend ({period})
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
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "#6A6386" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6A6386" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatVal(v)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.98)",
                    border: "1px solid rgba(126, 111, 177, 0.25)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: "8px 12px",
                  }}
                  formatter={(val: number) => [formatVal(val), title]}
                  labelStyle={{ fontWeight: "bold", color: "#241F3A", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke={color}
                  strokeWidth={3}
                  fill={`url(#detail-grad-${kpiKey})`}
                  activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        {/* Stats Grid */}
        {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
            <span className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider block">Peak</span>
            <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.max)}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
            <span className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider block">Average</span>
            <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.avg)}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-center">
            <span className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider block">Lowest</span>
            <span className="text-sm font-bold text-ink mt-0.5 block">{formatVal(stats.min)}</span>
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body!
  );
}
