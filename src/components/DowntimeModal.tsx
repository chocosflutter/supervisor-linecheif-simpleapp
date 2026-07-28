import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { useApp } from "@/store/appStore";
import { TODAY } from "@/lib/today";
import { lineName } from "@/lib/names";
import CustomTimePicker from "@/components/CustomTimePicker";

interface Props {
  lineId: string;
  onClose: () => void;
}

/** Supervisor logs UNPLANNED downtime: reason (dropdown) + time range. Paid labour. */
export default function DowntimeModal({ lineId, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const reasons = useApp((s) => s.downtimeReasons);
  const downtime = useApp((s) => s.downtime);
  const addDowntime = useApp((s) => s.addDowntime);

  const activeReasons = useMemo(() => reasons.filter((r) => r.active), [reasons]);
  const todays = useMemo(
    () => downtime.filter((d) => d.lineId === lineId && d.date === TODAY),
    [downtime, lineId]
  );

  const [reasonId, setReasonId] = useState(activeReasons[0]?.id ?? "");
  const [openReason, setOpenReason] = useState(false);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:15");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const reasonLabel = (id: string) => reasons.find((r) => r.id === id)?.label ?? id;

  const save = () => {
    if (!reasonId || !startTime || !endTime) return;
    addDowntime({
      id: `dt-${Date.now()}`,
      lineId,
      date: TODAY,
      startTime,
      endTime,
      reasonId,
      note: note.trim() || undefined,
      enteredBy: user?.name ?? "Supervisor",
      enteredAt: new Date().toISOString(),
    });
    setSaved(true);
    setNote("");
    setTimeout(() => setSaved(false), 1500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise max-h-[88vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-ink flex items-center gap-2">
              <AlertTriangle size={18} className="text-state-warning" />
              {t("downtime.title")}
            </h3>
            <p className="text-[11px] text-brand font-semibold">
              {lineName(lineId, lang)} · {t("downtime.unplanned")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Reason dropdown */}
        <div className="relative">
          <label className="block font-semibold text-ink mb-1 text-xs">{t("downtime.reason")}</label>
          <button
            type="button"
            onClick={() => setOpenReason(!openReason)}
            className="w-full bg-slate-50 border border-brand/20 rounded-xl px-3 py-2.5 text-xs font-semibold text-ink flex items-center justify-between shadow-sm hover:border-brand/40 transition"
          >
            <span>{reasonId ? reasonLabel(reasonId) : t("common.select")}</span>
            <ChevronDown size={16} className={`text-ink-muted transition-transform ${openReason ? "rotate-180" : ""}`} />
          </button>
          {openReason && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenReason(false)} />
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 z-50 max-h-52 overflow-y-auto no-scrollbar">
                {activeReasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setReasonId(r.id);
                      setOpenReason(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
                      reasonId === r.id ? "bg-brand text-white" : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <span>{r.label}</span>
                    {reasonId === r.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-ink mb-1 text-xs">{t("downtime.from")}</label>
            <CustomTimePicker value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <label className="block font-semibold text-ink mb-1 text-xs">{t("downtime.to")}</label>
            <CustomTimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block font-semibold text-ink mb-1 text-xs">{t("downtime.note")}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Needle plate jam on station 6"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <button
          onClick={save}
          disabled={!reasonId}
          className={`w-full font-semibold rounded-2xl py-3 transition active:scale-[0.98] shadow-glass flex items-center justify-center gap-2 disabled:opacity-50 ${
            saved ? "bg-state-success text-white" : "bg-brand text-white"
          }`}
        >
          {saved ? (
            <>
              <Check size={18} /> {t("downtime.saved")}
            </>
          ) : (
            t("downtime.save")
          )}
        </button>

        {/* Today's downtime list */}
        <div className="pt-1">
          <p className="text-xs font-bold text-ink mb-2">{t("downtime.today")}</p>
          {todays.length === 0 ? (
            <p className="text-[11px] text-ink-muted italic">{t("downtime.none")}</p>
          ) : (
            <div className="space-y-2">
              {todays.map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-ink block truncate">{reasonLabel(d.reasonId)}</span>
                    {d.note && <span className="text-[10px] text-ink-muted block truncate">{d.note}</span>}
                  </div>
                  <span className="font-semibold text-state-warning shrink-0 ml-2">
                    {d.startTime}–{d.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
