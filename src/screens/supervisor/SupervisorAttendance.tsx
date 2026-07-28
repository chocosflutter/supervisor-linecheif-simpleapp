import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, History, ArrowLeft, Search, Edit2, Clock, X, ChevronDown, ShieldAlert } from "lucide-react";
import { useApp } from "@/store/appStore";
import { lineName } from "@/lib/names";
import { TODAY } from "@/lib/today";
import GlassCard from "@/components/GlassCard";
import Stepper from "@/components/Stepper";

export default function SupervisorAttendance() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user)!;
  const lang = useApp((s) => s.lang);
  const saveAttendance = useApp((s) => s.saveAttendance);
  const attendanceList = useApp((s) => s.attendance);
  const resolveAlert = useApp((s) => s.resolveAlert);
  const alerts = useApp((s) => s.alerts);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // IE-driven correction context
  const correctLine = searchParams.get("correctLine");
  const correctDate = searchParams.get("correctDate");
  const correctAlertId = searchParams.get("alert");
  const correctionKey = correctLine && correctDate ? `${correctLine}-${correctDate}` : null;
  const correctionAlert = correctAlertId ? alerts.find((a) => a.id === correctAlertId) : null;

  const primaryLine = user.lineIds[0];

  const [subView, setSubView] = useState<"entry" | "history">("entry");
  const [selectedLine, setSelectedLine] = useState(primaryLine);
  const [openLineDropdown, setOpenLineDropdown] = useState(false);

  // Today's attendance state
  const todayAtt = attendanceList.find((a) => a.lineId === selectedLine && a.date === TODAY);
  const [v, setV] = useState({
    operators: todayAtt?.operators ?? 24,
    helpers: todayAtt?.helpers ?? 6,
    pressmen: todayAtt?.pressmen ?? 3,
    checkers: todayAtt?.checkers ?? 3,
  });
  const [done, setDone] = useState(false);

  // History Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "today" | "past">("all");

  // Inline Editing State for History Records
  const [editingKey, setEditingKey] = useState<string | null>(null); // "lineId-date"
  const [editCounts, setEditCounts] = useState({ operators: 24, helpers: 6, pressmen: 3, checkers: 3 });
  const [remark, setRemark] = useState(""); // optional supervisor remark for IE (correction mode)

  // When arriving from an IE notification, jump straight to the flagged record
  // in edit mode with only that entry unlocked.
  useEffect(() => {
    if (!correctLine || !correctDate) return;
    setSubView("history");
    setSelectedLine(correctLine);
    const rec = attendanceList.find((a) => a.lineId === correctLine && a.date === correctDate);
    if (rec) {
      setEditingKey(`${correctLine}-${correctDate}`);
      setEditCounts({ operators: rec.operators, helpers: rec.helpers, pressmen: rec.pressmen, checkers: rec.checkers });
    }
  }, [correctLine, correctDate, attendanceList]);

  const total = v.operators + v.helpers + v.pressmen + v.checkers;

  const submitToday = () => {
    saveAttendance({
      lineId: selectedLine,
      date: TODAY,
      ...v,
    });
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  const startEditHistory = (lineId: string, date: string, current: { operators: number; helpers: number; pressmen: number; checkers: number }) => {
    setEditingKey(`${lineId}-${date}`);
    setEditCounts({ ...current });
  };

  const saveHistoryCorrection = (lineId: string, date: string) => {
    const orig = attendanceList.find((x) => x.lineId === lineId && x.date === date);
    saveAttendance({
      lineId,
      date,
      ...editCounts,
    });
    setEditingKey(null);

    // If this edit was driven by an IE alert, auto-resolve it with the exact
    // change so the IE audit screen reflects what the supervisor corrected.
    const key = `${lineId}-${date}`;
    if (correctAlertId && key === correctionKey && orig) {
      const changes: string[] = [];
      if (editCounts.operators !== orig.operators) changes.push(`operators ${orig.operators}→${editCounts.operators}`);
      if (editCounts.helpers !== orig.helpers) changes.push(`helpers ${orig.helpers}→${editCounts.helpers}`);
      if (editCounts.pressmen !== orig.pressmen) changes.push(`pressmen ${orig.pressmen}→${editCounts.pressmen}`);
      if (editCounts.checkers !== orig.checkers) changes.push(`checkers ${orig.checkers}→${editCounts.checkers}`);
      const diff = changes.length ? changes.join(", ") : "reviewed, no change needed";
      const note = remark.trim() ? `${diff} — Remark: ${remark.trim()}` : diff;
      resolveAlert(correctAlertId, note);
      navigate("/notifications", { replace: true });
    }
  };

  // Filter history to supervisor's lines
  const myHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return attendanceList
      .filter((a) => user.lineIds.includes(a.lineId))
      .filter((a) => {
        const lName = lineName(a.lineId, lang).toLowerCase();
        const dStr = a.date.toLowerCase();
        const matchesQuery = !query || lName.includes(query) || dStr.includes(query);

        const isToday = a.date === TODAY;
        const matchesStatus =
          filterStatus === "all"
            ? true
            : filterStatus === "today"
              ? isToday
              : !isToday;

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceList, user.lineIds, lang, searchQuery, filterStatus]);

  const displayHistory = correctionKey
    ? attendanceList.filter((a) => `${a.lineId}-${a.date}` === correctionKey)
    : myHistory;

  if (subView === "history") {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => (correctionKey ? navigate("/notifications", { replace: true }) : setSubView("entry"))}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline glass-1 px-3.5 py-1.5 rounded-full border border-brand/20 active:scale-95 transition"
          >
            <ArrowLeft size={16} />
            <span>{correctionKey ? t("notifications.title") : t("common.back")}</span>
          </button>

          <span className="text-xs font-semibold text-ink-muted">
            {displayHistory.length} {displayHistory.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink">
            {correctionKey ? "Correct Attendance" : t("attendance.attendanceHistory")}
          </h1>
          <p className="text-xs text-ink-muted">
            {correctionKey
              ? "Only the flagged record is editable here."
              : "Past and present daily workforce attendance records"}
          </p>
        </div>

        {/* IE instruction banner */}
        {correctionAlert && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
            <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                {t("notifications.ieFlag")} · {correctionAlert.raisedBy}
              </span>
              <p className="text-xs text-amber-900 font-medium">"{correctionAlert.note}"</p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {!correctionKey && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by line or date (YYYY-MM-DD)..."
            className="w-full glass-1 bg-white/90 border border-brand/20 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
        )}

        {/* Status Filter Pills */}
        {!correctionKey && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "all" ? "bg-brand text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            All History
          </button>
          <button
            onClick={() => setFilterStatus("today")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "today" ? "bg-state-success text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            Today's Entry
          </button>
          <button
            onClick={() => setFilterStatus("past")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === "past" ? "bg-slate-700 text-white shadow-sm" : "glass-1 text-ink-muted hover:text-ink"
            }`}
          >
            Past Days
          </button>
        </div>
        )}

        {/* History List Cards */}
        {displayHistory.length === 0 ? (
          <GlassCard level={2} className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-ink-muted">{t("attendance.noHistory")}</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-brand underline font-medium"
              >
                Clear Search Filter
              </button>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {displayHistory.map((a) => {
              const isToday = a.date === TODAY;
              const key = `${a.lineId}-${a.date}`;
              const isEditing = editingKey === key;
              const isFlagged = correctionKey === key;
              const cardTotal = a.operators + a.helpers + a.pressmen + a.checkers;

              return (
                <GlassCard
                  key={key}
                  level={2}
                  className={`p-4 transition ${
                    isFlagged
                      ? "border-2 border-amber-400 ring-2 ring-amber-300/50 bg-white shadow-md"
                      : isToday
                        ? "border-2 border-brand/40 bg-white/95 shadow-md"
                        : "opacity-90"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-ink">{lineName(a.lineId, lang)}</span>
                        {isToday ? (
                          <span className="text-xs bg-state-success/15 text-state-success font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-state-success animate-pulse" />
                            Today
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-200 text-slate-600 font-medium px-2.5 py-0.5 rounded-full">
                            Past Record
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted font-medium mt-0.5 flex items-center gap-1">
                        <Clock size={12} /> Date: {a.date}
                      </p>
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => startEditHistory(a.lineId, a.date, a)}
                        className="text-xs bg-brand/10 hover:bg-brand hover:text-white text-brand font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 border border-brand/20 active:scale-95 shadow-sm"
                      >
                        <Edit2 size={13} />
                        <span>{t("attendance.editAttendance")}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Editing Form */}
                  {isEditing ? (
                    <div className="mt-3 p-3.5 bg-brand-100/60 rounded-2xl border border-brand/40 space-y-2.5 animate-fadeIn">
                      <p className="text-xs font-bold text-brand-700">Modify Workforce Entry</p>
                      <div className="glass-solid rounded-xl px-3 divide-y divide-ink/5 bg-white">
                        <Stepper label={t("attendance.operators")} value={editCounts.operators} onChange={(x) => setEditCounts({ ...editCounts, operators: x })} />
                        <Stepper label={t("attendance.helpers")} value={editCounts.helpers} onChange={(x) => setEditCounts({ ...editCounts, helpers: x })} />
                        <Stepper label={t("attendance.pressmen")} value={editCounts.pressmen} onChange={(x) => setEditCounts({ ...editCounts, pressmen: x })} />
                        <Stepper label={t("attendance.checkers")} value={editCounts.checkers} onChange={(x) => setEditCounts({ ...editCounts, checkers: x })} />
                      </div>
                      {isFlagged && (
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-ink-muted block mb-1">
                            {t("notifications.remark")}
                          </label>
                          <input
                            type="text"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder={t("notifications.remarkPlaceholder")}
                            className="w-full bg-white border border-brand/20 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-ink">Total: {editCounts.operators + editCounts.helpers + editCounts.pressmen + editCounts.checkers}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveHistoryCorrection(a.lineId, a.date)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-brand text-white shadow-md hover:bg-brand-600 active:scale-95"
                          >
                            {t("attendance.saveCorrection")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/80 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">{t("attendance.operators")}</span>
                        <span className="font-bold text-sm text-ink">{a.operators}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">{t("attendance.helpers")}</span>
                        <span className="font-bold text-sm text-ink">{a.helpers}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">{t("attendance.pressmen")}</span>
                        <span className="font-bold text-sm text-ink">{a.pressmen}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-[10px] uppercase tracking-wider font-semibold">{t("attendance.checkers")}</span>
                        <span className="font-bold text-sm text-ink">{a.checkers}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-ink-muted font-medium">{t("attendance.total")}</span>
                    <span className="font-bold text-brand text-sm">{cardTotal} present</span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Attendance Entry View (subView === "entry")
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header with History Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("attendance.title")}</h1>
          <p className="text-xs text-ink-muted">{lineName(selectedLine, lang)}</p>
        </div>
        <button
          onClick={() => setSubView("history")}
          className="glass-1 hover:bg-brand hover:text-white transition text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-brand-700 border border-brand/20 active:scale-95 shadow-sm"
        >
          <History size={14} />
          <span>{t("attendance.history")}</span>
        </button>
      </div>

      {/* Main Entry Card Form (opaque glass-solid surface matching LoadStyle pattern) */}
      <GlassCard level="solid" hairline className="p-4 space-y-4">
        {user.lineIds.length > 1 && (
          <div className="relative">
            <label className="text-xs font-medium text-ink-muted mb-1 block">Select Line</label>
            <button
              type="button"
              onClick={() => setOpenLineDropdown(!openLineDropdown)}
              className="w-full bg-white border border-brand/20 rounded-2xl px-4 py-3 text-xs font-semibold text-ink flex items-center justify-between shadow-sm hover:border-brand/40 transition active:scale-[0.99] text-left cursor-pointer"
            >
              <span>{lineName(selectedLine, lang)}</span>
              <ChevronDown size={16} className={`text-ink-muted transition-transform duration-200 ${openLineDropdown ? "rotate-180" : ""}`} />
            </button>

            {openLineDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenLineDropdown(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border-2 border-brand/30 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-fadeIn z-50 max-h-56 overflow-y-auto no-scrollbar">
                  {user.lineIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedLine(id);
                        setOpenLineDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between font-semibold transition ${
                        selectedLine === id ? "bg-brand text-white shadow-sm" : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>{lineName(id, lang)}</span>
                      {selectedLine === id && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="glass-solid rounded-2xl px-4 divide-y divide-ink/5 border border-slate-100">
          <Stepper label={t("attendance.operators")} value={v.operators} onChange={(x) => setV({ ...v, operators: x })} />
          <Stepper label={t("attendance.helpers")} value={v.helpers} onChange={(x) => setV({ ...v, helpers: x })} />
          <Stepper label={t("attendance.pressmen")} value={v.pressmen} onChange={(x) => setV({ ...v, pressmen: x })} />
          <Stepper label={t("attendance.checkers")} value={v.checkers} onChange={(x) => setV({ ...v, checkers: x })} />
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-ink-muted font-medium">{t("attendance.total")}</span>
          <span className="text-xl font-bold text-brand">{total} present</span>
        </div>

        <button
          onClick={submitToday}
          className={`w-full font-semibold rounded-2xl py-3.5 transition active:scale-[0.98] shadow-glass flex items-center justify-center gap-2 ${
            done ? "bg-state-success text-white" : "bg-brand text-white"
          }`}
        >
          {done ? (
            <>
              <Check size={20} /> {t("attendance.saved")}
            </>
          ) : (
            t("attendance.save")
          )}
        </button>
      </GlassCard>

      <p className="text-xs text-ink-muted px-1">
        {t("common.today")}: {TODAY}
      </p>
    </div>
  );
}
