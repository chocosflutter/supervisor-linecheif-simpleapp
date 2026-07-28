import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import Stepper from "@/components/Stepper";

interface Props {
  lineId: string;
  date: string;
  onDone: () => void;
}

export default function AttendanceGate({ lineId, date, onDone }: Props) {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const save = useApp((s) => s.saveAttendance);
  const [v, setV] = useState({ operators: 24, helpers: 6, pressmen: 3, checkers: 3 });
  const total = v.operators + v.helpers + v.pressmen + v.checkers;

  const submit = () => {
    save({ lineId, date, ...v });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-brand/20 backdrop-blur-[2px]" />
      <div className="relative w-full glass-3 rounded-t-sheet shadow-glass p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-rise">
        <div className="h-1.5 w-12 bg-ink/15 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink">{t("attendance.title")}</h2>
        <p className="text-sm text-ink-muted mb-1">{lineName(lineId, lang)}</p>
        <p className="text-xs text-ink-muted mb-4">{t("attendance.prompt")}</p>

        <div className="glass-solid rounded-2xl px-4 divide-y divide-ink/5">
          <Stepper label={t("attendance.operators")} value={v.operators} onChange={(x) => setV({ ...v, operators: x })} />
          <Stepper label={t("attendance.helpers")} value={v.helpers} onChange={(x) => setV({ ...v, helpers: x })} />
          <Stepper label={t("attendance.pressmen")} value={v.pressmen} onChange={(x) => setV({ ...v, pressmen: x })} />
          <Stepper label={t("attendance.checkers")} value={v.checkers} onChange={(x) => setV({ ...v, checkers: x })} />
        </div>

        <div className="flex items-center justify-between mt-4 mb-3 px-1">
          <span className="text-sm text-ink-muted">{t("attendance.total")}</span>
          <span className="text-xl font-bold text-brand">{total}</span>
        </div>

        <button
          onClick={submit}
          className="w-full bg-brand text-white font-semibold rounded-2xl py-3.5 active:scale-[0.98] transition shadow-glass"
        >
          {t("attendance.saveStart")}
        </button>
      </div>
    </div>
  );
}
