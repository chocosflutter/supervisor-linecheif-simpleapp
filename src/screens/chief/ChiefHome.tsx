import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import { TODAY } from "@/lib/today";
import KpiGrid from "@/components/KpiGrid";
import DateRangePicker, { type DatePreset } from "@/components/DateRangePicker";

export default function ChiefHome() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const lsState = useApp((s) => s.lineStyles);
  const styles = useApp((s) => s.styles);
  const factories = useApp((s) => s.factories);

  const [selectedLineId, setSelectedLineId] = useState<string>("all");
  const [openDropdown, setOpenDropdown] = useState<boolean>(false);

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState<string>(TODAY);
  const [endDate, setEndDate] = useState<string>(TODAY);

  const activeLineIds = useMemo(() => {
    return selectedLineId === "all" ? user.lineIds : [selectedLineId];
  }, [selectedLineId, user.lineIds]);

  const currentStyle = useMemo(() => {
    if (selectedLineId === "all") return null;
    const ls = lsState.find((x) => x.lineId === selectedLineId && !x.unloadedAt);
    return styles.find((s) => s.id === ls?.styleId);
  }, [selectedLineId, lsState, styles]);

  return (
    <div className="space-y-4 relative">
      {/* Click-outside backdrop */}
      {openDropdown && (
        <div className="fixed inset-0 z-20" onClick={() => setOpenDropdown(false)} />
      )}

      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{user.name}</p>
        <h1 className="text-2xl font-bold text-ink">{factories.length > 0 ? factories[0].name : t("chief.myLines")}</h1>
      </div>

      {/* Line Dropdown Selector Row */}
      <div className="relative z-30">
        <button
          onClick={() => setOpenDropdown(!openDropdown)}
          className="text-xs font-semibold rounded-full px-3.5 py-1.5 flex items-center gap-1.5 bg-brand text-white shadow-md transition active:scale-[0.98]"
        >
          <span>{selectedLineId === "all" ? t("chief.allLines") : lineName(selectedLineId, lang)}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${openDropdown ? "rotate-180" : ""}`} />
        </button>

        {openDropdown && (
          <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-50">
            <button
              onClick={() => {
                setSelectedLineId("all");
                setOpenDropdown(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                selectedLineId === "all" ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
              }`}
            >
              <span>{t("chief.allLines")}</span>
              {selectedLineId === "all" && <Check size={14} className="text-white" />}
            </button>

            {user.lineIds.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setSelectedLineId(id);
                  setOpenDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-medium ${
                  selectedLineId === id ? "bg-brand text-white font-bold" : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span>{lineName(id, lang)}</span>
                {selectedLineId === id && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permanent Dedicated Row for Date Range Filter */}
      <div className="relative z-20">
        <DateRangePicker
          preset={datePreset}
          startDate={startDate}
          endDate={endDate}
          onChange={(p, s, e) => {
            setDatePreset(p);
            setStartDate(s);
            setEndDate(e);
          }}
        />
      </div>

      {/* Selected Style Indicator if a specific line is active */}
      {currentStyle && (
        <div className="animate-fadeIn">
          <span className="inline-block text-xs glass-1 rounded-full px-3 py-1 text-brand-700 font-medium border border-brand/20">
            {t("chief.currentStyle")}: {currentStyle.code} · {currentStyle.name}
          </span>
        </div>
      )}

      {/* Dynamic KPI Grid */}
      <KpiGrid lineIds={activeLineIds} showProfit datePreset={datePreset} startDate={startDate} endDate={endDate} />
    </div>
  );
}
