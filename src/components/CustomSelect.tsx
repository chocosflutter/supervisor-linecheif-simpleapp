import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps<T extends string = string> {
  options: CustomSelectOption<T>[];
  value: T;
  onChange: (val: T) => void;
  placeholder?: string;
  className?: string;
}

export default function CustomSelect<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOpt = options.find((o) => o.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block text-left w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-50/90 border border-brand/25 hover:border-brand/50 rounded-xl px-3 py-2 text-xs font-semibold text-ink flex items-center justify-between gap-2 shadow-sm transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOpt?.icon}
          <span className="truncate">{selectedOpt ? selectedOpt.label : placeholder}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-brand transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Options Menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-[999] max-h-56 overflow-y-auto no-scrollbar">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium transition ${
                  isSelected
                    ? "bg-brand text-white font-bold shadow-sm"
                    : "text-slate-800 hover:bg-brand-100/70 hover:text-brand font-medium"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check size={14} className="text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
