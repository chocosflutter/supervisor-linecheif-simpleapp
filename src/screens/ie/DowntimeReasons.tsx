import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, AlertTriangle, Check, Ban } from "lucide-react";
import { useApp } from "@/store/appStore";
import { FACTORY_ID } from "@/data/mock";
import GlassCard from "@/components/GlassCard";

export default function DowntimeReasons() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useApp((s) => s.user);
  const reasons = useApp((s) => s.downtimeReasons);
  const addDowntimeReason = useApp((s) => s.addDowntimeReason);
  const toggleDowntimeReason = useApp((s) => s.toggleDowntimeReason);

  const factoryId = user?.factoryId ?? FACTORY_ID;
  const factoryReasons = reasons.filter((r) => r.factoryId === factoryId);

  const [label, setLabel] = useState("");

  const add = () => {
    const clean = label.trim();
    if (!clean) return;
    addDowntimeReason({ id: `dr-${Date.now()}`, factoryId, label: clean, active: true });
    setLabel("");
  };

  return (
    <div className="space-y-4 animate-rise pb-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand glass-1 px-3 py-1.5 rounded-full hover:bg-brand/10 transition active:scale-95"
      >
        <ArrowLeft size={16} />
        <span>{t("common.back")}</span>
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-ink flex items-center gap-2">
          <AlertTriangle size={20} className="text-state-warning" />
          {t("downtime.reasonsTitle")}
        </h1>
        <p className="text-xs text-ink-muted mt-0.5">{t("downtime.reasonsSubtitle")}</p>
      </div>

      {/* Add reason */}
      <GlassCard level="solid" hairline className="p-4 space-y-3">
        <label className="block font-semibold text-ink text-xs">{t("downtime.reasonLabel")}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Thread break, Fabric shortage..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={add}
            disabled={!label.trim()}
            className="px-4 py-2.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition disabled:opacity-50"
          >
            <Plus size={14} />
            <span>{t("downtime.addReason")}</span>
          </button>
        </div>
      </GlassCard>

      {/* Reason list */}
      <div className="space-y-2">
        {factoryReasons.map((r) => (
          <GlassCard
            key={r.id}
            level={2}
            className={`p-3 flex items-center justify-between border border-slate-100 ${
              r.active ? "" : "opacity-60"
            }`}
          >
            <span className="text-sm font-semibold text-ink">{r.label}</span>
            <button
              onClick={() => toggleDowntimeReason(r.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 border active:scale-95 ${
                r.active
                  ? "text-state-success bg-state-success/10 border-state-success/20"
                  : "text-ink-muted bg-slate-100 border-slate-200"
              }`}
            >
              {r.active ? <Check size={13} /> : <Ban size={13} />}
              <span>{r.active ? t("superadmin.active") : t("superadmin.inactive")}</span>
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
