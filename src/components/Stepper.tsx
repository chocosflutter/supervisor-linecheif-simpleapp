import { Minus, Plus } from "lucide-react";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}

export default function Stepper({ label, value, onChange, min = 0, step = 1 }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-ink font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={dec}
          className="h-11 w-11 rounded-xl bg-brand-100 text-brand-700 grid place-items-center active:scale-95 transition"
          aria-label="decrease"
        >
          <Minus size={20} />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value.replace(/\D/g, "")) || 0))}
          inputMode="numeric"
          className="w-16 text-center text-lg font-semibold bg-transparent outline-none"
        />
        <button
          onClick={inc}
          className="h-11 w-11 rounded-xl bg-brand text-white grid place-items-center active:scale-95 transition"
          aria-label="increase"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
