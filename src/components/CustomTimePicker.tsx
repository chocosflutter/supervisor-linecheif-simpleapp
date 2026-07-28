import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";

interface CustomTimePickerProps {
  value: string; // e.g. "10:15"
  onChange: (time: string) => void;
  className?: string;
}

export default function CustomTimePicker({
  value,
  onChange,
  className = "",
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoursStr, minutesStr] = (value || "08:00").split(":");
  const currentHour = parseInt(hoursStr || "8", 10);
  const currentMin = parseInt(minutesStr || "0", 10);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hoursList = Array.from({ length: 14 }, (_, i) => i + 6); // 06:00 to 19:00
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const handleSelectHour = (h: number) => {
    const formattedH = String(h).padStart(2, "0");
    const formattedM = String(currentMin).padStart(2, "0");
    onChange(`${formattedH}:${formattedM}`);
  };

  const handleSelectMin = (m: number) => {
    const formattedH = String(currentHour).padStart(2, "0");
    const formattedM = String(m).padStart(2, "0");
    onChange(`${formattedH}:${formattedM}`);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-50 border border-brand/30 hover:border-brand rounded-xl px-3 py-2 text-ink font-bold flex items-center justify-between text-xs shadow-sm transition active:scale-[0.99]"
      >
        <span className="text-brand font-extrabold tracking-wide">{value || "08:00"}</span>
        <Clock size={15} className="text-brand shrink-0" />
      </button>

      {/* Floating Time Picker Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-3 z-[999999] flex gap-3 animate-fadeIn">
          {/* Hours Column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase block text-center pb-0.5 border-b border-slate-100">
              Hour
            </span>
            <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1 pr-1">
              {hoursList.map((h) => {
                const isSelected = h === currentHour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={`w-10 py-1.5 rounded-xl text-xs font-bold transition text-center block ${
                      isSelected
                        ? "bg-brand text-white shadow-sm"
                        : "text-slate-700 hover:bg-brand-100 hover:text-brand"
                    }`}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-brand font-extrabold self-center text-sm">:</div>

          {/* Minutes Column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase block text-center pb-0.5 border-b border-slate-100">
              Minute
            </span>
            <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1 pr-1">
              {minutesList.map((m) => {
                const isSelected = m === currentMin;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMin(m)}
                    className={`w-10 py-1.5 rounded-xl text-xs font-bold transition text-center block ${
                      isSelected
                        ? "bg-brand text-white shadow-sm"
                        : "text-slate-700 hover:bg-brand-100 hover:text-brand"
                    }`}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
