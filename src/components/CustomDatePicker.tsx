import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  label?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDatePicker({
  value,
  onChange,
  label,
  className = "",
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or fallback to today
  const initialDate = value ? new Date(value) : new Date();
  const validDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [currentYear, setCurrentYear] = useState(validDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validDate.getMonth());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update calendar view if value prop changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  }, [value]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Calculate calendar grid days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const formatted = `${currentYear}-${monthStr}-${dayStr}`;
    onChange(formatted);
    setOpen(false);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const parts = value.split("-");
    if (parts.length !== 3) return false;
    return (
      parseInt(parts[0], 10) === currentYear &&
      parseInt(parts[1], 10) === currentMonth + 1 &&
      parseInt(parts[2], 10) === day
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === currentYear &&
      today.getMonth() === currentMonth &&
      today.getDate() === day
    );
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && <label className="block text-[10px] font-bold text-ink-muted mb-1">{label}</label>}

      {/* Brand-themed Date Input Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-white border border-brand/30 hover:border-brand rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink flex items-center justify-between gap-1.5 shadow-sm transition active:scale-[0.98] cursor-pointer"
      >
        <span className="font-mono text-ink text-[11px]">{value || "Select date"}</span>
        <CalendarIcon size={13} className="text-brand shrink-0" />
      </button>

      {/* Brand-themed Custom Calendar Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-3 z-[999999] animate-fadeIn">
          {/* Calendar Header: Month & Year + Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-ink-muted hover:text-brand transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-ink">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-ink-muted hover:text-brand transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS.map((d) => (
              <span key={d} className="text-[10px] font-bold text-brand-700/80 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Blank leading days from prev month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <span key={`prev-${i}`} className="text-[10px] text-slate-300 py-1.5">
                {daysInPrevMonth - firstDayOfMonth + i + 1}
              </span>
            ))}

            {/* Active Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
                    selected
                      ? "bg-brand text-white font-bold shadow-md"
                      : today
                      ? "border border-brand text-brand font-bold bg-brand-100/40"
                      : "text-slate-700 hover:bg-brand-100 hover:text-brand-700"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
