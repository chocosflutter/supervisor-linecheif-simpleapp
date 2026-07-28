import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Info, TrendingDown, TrendingUp, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { KpiKey, KpiStatus } from "@/types";
import { useApp } from "@/store/appStore";
import GlassCard from "./GlassCard";

interface Props {
  kpiKey?: KpiKey;
  align?: "left" | "right";
  title: string;
  value: string;
  subtitle?: string;
  status?: KpiStatus;
  trend?: number; // percent change; sign drives arrow
  spark?: number[];
  onClick?: () => void;
}

const statusColor: Record<KpiStatus, string> = {
  success: "#12B886",
  warning: "#E8A317",
  danger: "#E5484D",
};

const KPI_FORMULAS: Record<string, { en: string; bn: string }> = {
  productivity: {
    en: "Value Productivity = (Produced Qty × Style Value/pc) ÷ (Total Workforce × Hours Worked)",
    bn: "ভ্যালু প্রোডাক্টিভিটি = (উৎপাদিত পিস × স্টাইল মূল্য) ÷ (মোট কর্মী × কাজের ঘণ্টা)",
  },
  cost: {
    en: "Per-Piece Cost = Total Labor Cost ÷ Produced Qty (Labor Cost = Sum of Class-wise Salaries × Hours Worked)",
    bn: "প্রতি পিস খরচ = মোট মজুরি খরচ ÷ উৎপাদিত পিস (মজুরি খরচ = শ্রেণীভিত্তিক কর্মী মজুরির যোগফল × ঘণ্টা)",
  },
  efficiency: {
    en: "Efficiency % = (Produced Qty × SMV) ÷ (60 × Hours Worked × Total Workforce) × 100",
    bn: "দক্ষতা % = (উৎপাদিত পিস × SMV) ÷ (৬০ × কাজের ঘণ্টা × কর্মী) × ১০০",
  },
  profit: {
    en: "Line Net Profit = (Good Qty × CM/pc) − Total Labor Cost (Labor Cost = Sum of Class-wise Salaries × Hours Worked)",
    bn: "লাইন নিট মুনাফা = (ভাল পিস × CM/পিস) − মোট মজুরি খরচ (মজুরি খরচ = শ্রেণীভিত্তিক কর্মী মজুরির যোগফল × ঘণ্টা)",
  },
  changeover: {
    en: "Changeover Time = (Time of 1st Good Pc New Style) − (Time of Last Good Pc Old Style)",
    bn: "চেঞ্জওভার সময় = (নতুন স্টাইলের ১ম পিস) − (পুরাতন স্টাইলের শেষ পিস)",
  },
  defective: {
    en: "Defective % = (Total Defective Pcs ÷ Total Produced Pcs) × 100",
    bn: "ত্রুটিপূর্ণ % = (মোট ত্রুটিপূর্ণ পিস ÷ মোট উৎপাদিত পিস) × ১০০",
  },
  absenteeism: {
    en: "Absenteeism % = [(Planned Headcount − Present Workforce) ÷ Planned Headcount] × 100",
    bn: "অনুপস্থিতি % = [(পরিকল্পিত কর্মী − উপস্থিত কর্মী) ÷ পরিকল্পিত কর্মী] × ১০০",
  },
  dhu: {
    en: "DHU = (Total Defects Found × 100) ÷ Total Produced Pcs",
    bn: "ডিএইচইউ = (মোট পাওয়া ত্রুটি × ১০০) ÷ মোট উৎপাদিত পিস",
  },
};

export default function KpiCard({ kpiKey, align = "right", title, value, subtitle, status = "success", trend, spark, onClick }: Props) {
  const lang = useApp((s) => s.lang);
  const [showTooltip, setShowTooltip] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; arrowPos: "left" | "right" } | null>(null);

  const color = statusColor[status];
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  const up = (trend ?? 0) >= 0;

  const formula = kpiKey ? KPI_FORMULAS[kpiKey] : null;

  // Auto-disappear tooltip after 5 seconds
  useEffect(() => {
    if (!showTooltip) return;
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [showTooltip]);

  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showTooltip) {
      setShowTooltip(false);
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      if (align === "left") {
        setPos({
          top: rect.bottom + 8,
          left: Math.max(12, rect.left - 12),
          arrowPos: "left",
        });
      } else {
        setPos({
          top: rect.bottom + 8,
          right: Math.max(12, window.innerWidth - rect.right - 12),
          arrowPos: "right",
        });
      }
    }
    setShowTooltip(true);
  };

  return (
    <GlassCard level={2} onClick={onClick} className="p-4 relative transition hover:shadow-md">
      <div className="flex items-start justify-between relative">
        <span className="text-xs font-medium text-ink-muted">{title}</span>

        <button
          ref={btnRef}
          type="button"
          onClick={toggleTooltip}
          title="View Formula"
          className="p-1 -mr-1 -mt-1 rounded-full text-ink-muted/80 hover:text-brand hover:bg-brand/10 transition active:scale-95 cursor-pointer"
        >
          <Info size={16} />
        </button>

        {/* Portal Tooltip Popover — Rendered at document.body level with fixed z-[9999] so it sits ABOVE ALL CARDS */}
        {showTooltip && formula && pos && createPortal(
          <>
            {/* Invisible Backdrop to click away */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
              }}
            />

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: `${pos.top}px`,
                left: pos.left !== undefined ? `${pos.left}px` : undefined,
                right: pos.right !== undefined ? `${pos.right}px` : undefined,
              }}
              className="z-[9999] w-60 sm:w-64 bg-white border-2 border-brand/40 rounded-2xl p-3.5 shadow-2xl animate-fadeIn text-left cursor-default"
            >
              {/* Speech Bubble Pointer Arrow */}
              <div
                className={clsx(
                  "absolute -top-2 w-3.5 h-3.5 bg-white border-t-2 border-l-2 border-brand/40 rotate-45",
                  pos.arrowPos === "left" ? "left-4" : "right-3.5"
                )}
              />

              <div className="flex items-center justify-between text-[11px] font-bold text-brand mb-1.5">
                <span>{lang === "bn" ? "হিসাবের সূত্র" : "Formula"}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTooltip(false);
                  }}
                  className="text-ink-muted hover:text-ink p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              <p className="text-[11px] font-sans font-bold text-ink leading-relaxed break-words whitespace-normal">
                {lang === "bn" ? formula.bn : formula.en}
              </p>
            </div>
          </>,
          document.body
        )}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold leading-none text-ink">{value}</span>
        {trend !== undefined && (
          <span
            className={clsx(
              "flex items-center gap-0.5 text-xs font-semibold mb-0.5",
              up ? "text-state-success" : "text-state-danger",
            )}
          >
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      {subtitle && <div className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</div>}

      {data.length > 1 && (
        <div className="h-10 mt-2 -mx-1 overflow-hidden rounded-b-xl">
          <ResponsiveContainer width="100%" height="100%">
            {(() => {
              const gradId = `grad-${title.replace(/[^a-zA-Z0-9]/g, "")}`;
              return (
                <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
                </AreaChart>
              );
            })()}
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}
