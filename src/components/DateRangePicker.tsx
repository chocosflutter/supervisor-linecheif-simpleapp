import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { TODAY } from "@/lib/today";
import CustomDatePicker from "./CustomDatePicker";

export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "custom";

interface DateRangePickerProps {
  preset: DatePreset;
  startDate?: string;
  endDate?: string;
  onChange: (preset: DatePreset, start: string, end: string) => void;
  className?: string;
}

export default function DateRangePicker({
  preset = "today",
  startDate = TODAY,
  endDate = TODAY,
  onChange,
  className = "",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreset = (p: DatePreset) => {
    let start = TODAY;
    let end = TODAY;

    const todayObj = new Date();

    if (p === "yesterday") {
      const y = new Date(todayObj);
      y.setDate(y.getDate() - 1);
      start = y.toISOString().split("T")[0];
      end = start;
    } else if (p === "last7") {
      const s = new Date(todayObj);
      s.setDate(s.getDate() - 6);
      start = s.toISOString().split("T")[0];
    } else if (p === "last30") {
      const s = new Date(todayObj);
      s.setDate(s.getDate() - 29);
      start = s.toISOString().split("T")[0];
    } else if (p === "custom") {
      start = customStart;
      end = customEnd;
    }

    onChange(p, start, end);
    if (p !== "custom") setOpen(false);
  };

  const getLabel = () => {
    switch (preset) {
      case "yesterday":
        return "Yesterday";
      case "last7":
        return "Last 7 Days";
      case "last30":
        return "Last 30 Days";
      case "custom":
        return `${startDate} — ${endDate}`;
      case "today":
      default:
        return `Today (${TODAY})`;
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Pill Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="glass-1 border border-brand/20 hover:border-brand/40 rounded-full px-3 py-1.5 text-xs font-bold text-ink flex items-center gap-1.5 shadow-sm transition active:scale-[0.98] cursor-pointer"
      >
        <Calendar size={13} className="text-brand shrink-0" />
        <span className="text-ink">{getLabel()}</span>
        <ChevronDown size={13} className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Menu */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 max-w-[calc(100vw-2.5rem)] bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-2 z-[99999] space-y-1 animate-fadeIn">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block px-2.5 pt-1">
            Filter Date Range:
          </span>

          <button
            type="button"
            onClick={() => handleSelectPreset("today")}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
              preset === "today" ? "bg-brand text-white shadow-sm" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>Today ({TODAY})</span>
            {preset === "today" && <Check size={14} className="text-white" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectPreset("yesterday")}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
              preset === "yesterday" ? "bg-brand text-white shadow-sm" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>Yesterday</span>
            {preset === "yesterday" && <Check size={14} className="text-white" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectPreset("last7")}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
              preset === "last7" ? "bg-brand text-white shadow-sm" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>Last 7 Days</span>
            {preset === "last7" && <Check size={14} className="text-white" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectPreset("last30")}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
              preset === "last30" ? "bg-brand text-white shadow-sm" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>Last 30 Days</span>
            {preset === "last30" && <Check size={14} className="text-white" />}
          </button>

          {/* Custom Date Inputs */}
          <div className="pt-2 border-t border-slate-100 px-2 space-y-2">
            <span className="text-[10px] font-bold text-ink-muted uppercase block">Custom Range:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <CustomDatePicker
                label="From"
                value={customStart}
                onChange={(val) => setCustomStart(val)}
              />
              <CustomDatePicker
                label="To"
                value={customEnd}
                onChange={(val) => setCustomEnd(val)}
              />
            </div>
            <button
              type="button"
              onClick={() => handleSelectPreset("custom")}
              className="w-full bg-brand text-white font-bold py-1.5 rounded-xl text-xs shadow-sm hover:bg-brand-700 transition"
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
