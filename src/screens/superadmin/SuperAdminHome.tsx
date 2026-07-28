import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Building2,
  Plus,
  X,
  UserPlus,
  LogIn,
  HardHat,
  LineChart,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/store/appStore";
import type { Factory, Role } from "@/types";
import GlassCard from "@/components/GlassCard";

const factoryRoles: { role: Role; icon: typeof HardHat }[] = [
  { role: "ie", icon: Ruler },
  { role: "chief", icon: LineChart },
  { role: "supervisor", icon: HardHat },
];

/* Add Factory modal */
function AddFactoryModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const factories = useApp((s) => s.factories);
  const addFactory = useApp((s) => s.addFactory);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");

  const save = () => {
    if (!name.trim() || !code.trim()) return;
    addFactory({
      id: `fac${factories.length + 1}-${Date.now()}`,
      name: name.trim(),
      code: code.trim(),
      city: city.trim() || undefined,
      active: true,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink">{t("superadmin.addFactory")}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">{t("superadmin.factoryName")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-ink mb-1">{t("superadmin.factoryCode")}</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="RBC-3"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink mb-1">{t("superadmin.city")}</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            {t("common.cancel")}
          </button>
          <button
            onClick={save}
            disabled={!name.trim() || !code.trim()}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm disabled:opacity-50"
          >
            {t("superadmin.addFactory")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SuperAdminHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const factories = useApp((s) => s.factories);
  const actAs = useApp((s) => s.actAs);

  const [showAdd, setShowAdd] = useState(false);

  const enter = (factory: Factory, role: Role) => {
    actAs(role, factory.id);
    navigate("/home");
  };

  return (
    <div className="space-y-4 animate-rise pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-brand" /> {t("roles.super_admin")}
          </p>
          <h1 className="text-xl font-extrabold text-ink">{t("superadmin.title")}</h1>
          <p className="text-xs text-ink-muted mt-0.5">{t("superadmin.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition shrink-0"
        >
          <Plus size={14} />
          <span>{t("superadmin.addFactory")}</span>
        </button>
      </div>

      {factories.length === 0 ? (
        <GlassCard level={2} className="p-8 text-center text-xs text-ink-muted">
          {t("superadmin.noFactories")}
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {factories.map((f) => (
            <GlassCard key={f.id} level="solid" hairline className="p-4 space-y-3 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="text-brand" size={18} />
                  <div>
                    <h3 className="font-bold text-sm text-ink">{f.name}</h3>
                    <p className="text-[11px] text-ink-muted">
                      {f.code}{f.city ? ` · ${f.city}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    f.active
                      ? "bg-state-success/15 text-state-success"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {f.active ? t("superadmin.active") : t("superadmin.inactive")}
                </span>
              </div>

              {/* User list: navigate to factory users page */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-muted uppercase">{t("superadmin.logins")}</span>
                <button
                  onClick={() => navigate(`/factory-users?factory=${f.id}`)}
                  className="text-[11px] text-brand font-semibold hover:underline flex items-center gap-1"
                >
                  <UserPlus size={13} /> User List
                </button>
              </div>

              {/* Act-as: enter this factory as any role */}
              <div>
                <span className="text-[11px] font-semibold text-ink-muted uppercase block mb-1.5">
                  {t("superadmin.actAs")}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {factoryRoles.map(({ role, icon: Icon }) => (
                    <button
                      key={role}
                      onClick={() => enter(f, role)}
                      className="glass-1 hover:bg-brand hover:text-white text-brand-700 rounded-xl py-2.5 flex flex-col items-center gap-1 text-[11px] font-semibold border border-brand/20 active:scale-95 transition"
                    >
                      <Icon size={16} />
                      <span>{t(`roles.${role}`)}</span>
                      <LogIn size={11} className="opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showAdd && <AddFactoryModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
