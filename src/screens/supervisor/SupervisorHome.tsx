import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PlusSquare } from "lucide-react";
import { useApp, SUPABASE_MODE } from "@/store/appStore";
import { lineName, localName } from "@/lib/names";
import { TODAY } from "@/lib/today";
import { subscribeToLine } from "@/realtime/subscribe";
import KpiGrid from "@/components/KpiGrid";
import GlassCard from "@/components/GlassCard";
import DateRangePicker, { type DatePreset } from "@/components/DateRangePicker";
import AttendanceGate from "./AttendanceGate";

export default function SupervisorHome() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const hasAttendance = useApp((s) => s.hasAttendanceToday);
  const lineStylesState = useApp((s) => s.lineStyles);
  const styles = useApp((s) => s.styles);
  const lines = useApp((s) => s.lines);
  const floors = useApp((s) => s.floors);
  const units = useApp((s) => s.units);
  const factories = useApp((s) => s.factories);

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState<string>(TODAY);
  const [endDate, setEndDate] = useState<string>(TODAY);

  // The supervisor's primary line (first). Gate is shown if today's attendance is missing.
  const primaryLine = user.lineIds[0];

  // Phase 6: scoped realtime subscription for the supervisor's primary line.
  useEffect(() => {
    if (!SUPABASE_MODE || !primaryLine) return;
    return subscribeToLine(primaryLine);
  }, [primaryLine]);

  const currentStyle = useMemo(() => {
    const ls = lineStylesState.find((x) => x.lineId === primaryLine && !x.unloadedAt);
    return styles.find((s) => s.id === ls?.styleId);
  }, [lineStylesState, primaryLine, styles]);

  const [gateDone, setGateDone] = useState(false);
  const needsGate = !hasAttendance(primaryLine, TODAY) && !gateDone && Boolean(currentStyle);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{user.name}</p>
        <h1 className="text-xl font-bold text-ink mb-2">{factories.length > 0 ? factories[0].name : t("app.title")}</h1>

        {/* Row 1: Unit · Floor · Line breadcrumb */}
        <div className="flex items-center gap-1.5 flex-wrap relative z-30 mb-2">
          {(() => {
            const line = lines.find((l) => l.id === primaryLine);
            const floor = line ? floors.find((f) => f.id === line.floorId) : undefined;
            const unit = floor ? units.find((u) => u.id === floor.unitId) : undefined;
            return (
              <>
                {unit && (
                  <span className="text-xs font-semibold rounded-full px-3 py-1.5 glass-1 text-ink-muted border border-brand/15">
                    {localName(unit, lang)}
                  </span>
                )}
                {floor && (
                  <span className="text-xs font-semibold rounded-full px-3 py-1.5 glass-1 text-ink-muted border border-brand/15">
                    {localName(floor, lang)}
                  </span>
                )}
                <span className="text-xs font-bold rounded-full px-3.5 py-1.5 bg-brand text-white shadow-md">
                  {lineName(primaryLine, lang)}
                </span>
              </>
            );
          })()}
        </div>

        {/* Row 2: Permanent Dedicated Row for Date Range Filter */}
        <div className="relative z-20 mb-2">
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

        {currentStyle && (
          <div className="mt-2">
            <span className="inline-block text-xs glass-1 rounded-full px-3 py-1 text-brand-700 font-medium border border-brand/20">
              {t("chief.currentStyle")}: {currentStyle.code} · {currentStyle.name}
            </span>
          </div>
        )}
      </div>

      <KpiGrid lineIds={user.lineIds} showProfit datePreset={datePreset} startDate={startDate} endDate={endDate} />

      <button
        onClick={() => nav("/production")}
        className="w-full bg-brand text-white font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-glass"
      >
        <PlusSquare size={20} />
        {t("production.addHour")}
      </button>

      <GlassCard level={2} className="p-4">
        <p className="text-sm text-ink-muted">{t("common.today")}</p>
        <p className="text-xs text-ink-muted mt-1">{TODAY}</p>
      </GlassCard>

      {needsGate && (
        <AttendanceGate lineId={primaryLine} date={TODAY} onDone={() => setGateDone(true)} />
      )}
    </div>
  );
}
