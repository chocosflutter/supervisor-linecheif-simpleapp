import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, UserPlus, HardHat, LineChart, Ruler, X, Check, Trash2 } from "lucide-react";
import { useApp, SUPABASE_MODE } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import type { Role } from "@/types";

interface FactoryUser {
  id: string;
  name: string;
  role: Role;
}

const roleIcon: Record<string, typeof HardHat> = { ie: Ruler, chief: LineChart, supervisor: HardHat };
const roleColor: Record<string, string> = {
  ie: "bg-brand-100 text-brand",
  chief: "bg-blue-100 text-blue-700",
  supervisor: "bg-amber-100 text-amber-700",
};

async function callManageUsers(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `https://grfjeiodszrgklnillwy.supabase.co/functions/v1/manage-factory-users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ action, ...body }),
    }
  );
  return res.json();
}

export default function FactoryUsers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const factoryId = searchParams.get("factory") ?? "";
  const factories = useApp((s) => s.factories);
  const factory = factories.find((f) => f.id === factoryId);

  const [users, setUsers] = useState<FactoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchUsers = () => {
    if (!factoryId) return;
    setLoading(true);
    if (SUPABASE_MODE) {
      supabase.from("users").select("id,name,role").eq("factory_id", factoryId)
        .then(({ data }) => {
          setUsers((data ?? []).map((u) => ({ id: u.id, name: u.name, role: u.role as Role })));
          setLoading(false);
        });
    } else {
      setUsers([
        { id: "ie1", name: "Anita (IE)", role: "ie" },
        { id: "chief1", name: "Karim (Line Chief)", role: "chief" },
        { id: "sup1", name: "Rahim (Supervisor)", role: "supervisor" },
      ]);
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [factoryId]);

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This will remove their login and profile permanently.`)) return;
    if (SUPABASE_MODE) {
      const res = await callManageUsers("delete", { user_id: userId });
      if (res.error) { alert(`Error: ${res.error}`); return; }
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const grouped = useMemo(() => {
    const map: Record<string, FactoryUser[]> = { ie: [], chief: [], supervisor: [] };
    users.forEach((u) => { if (map[u.role]) map[u.role].push(u); });
    return map;
  }, [users]);

  if (!factory) return <div className="p-6 text-center text-ink-muted">Factory not found.</div>;

  return (
    <div className="space-y-4 animate-rise pb-24">
      <button
        onClick={() => navigate("/factories", { replace: true })}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand glass-1 px-3 py-1.5 rounded-full hover:bg-brand/10 transition active:scale-95"
      >
        <ArrowLeft size={16} />
        <span>{t("common.back")}</span>
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-ink">{factory.name}</h1>
        <p className="text-xs text-ink-muted">{factory.code}{factory.city ? ` · ${factory.city}` : ""} — User Management</p>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition">
          <UserPlus size={14} /> Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-ink-muted py-8">Loading users...</div>
      ) : users.length === 0 ? (
        <GlassCard level={2} className="p-8 text-center text-xs text-ink-muted">
          No users yet. Click "Add User" to create one.
        </GlassCard>
      ) : (
        (["ie", "chief", "supervisor"] as const).map((role) => {
          const roleUsers = grouped[role] ?? [];
          const Icon = roleIcon[role] ?? HardHat;
          return (
            <div key={role} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg grid place-items-center ${roleColor[role]}`}><Icon size={15} /></span>
                <h2 className="text-sm font-bold text-ink">{t(`roles.${role}`)}</h2>
                <span className="text-[11px] font-medium text-ink-muted bg-slate-100 px-2 py-0.5 rounded-full">{roleUsers.length}</span>
              </div>
              {roleUsers.length === 0 ? (
                <p className="text-[11px] text-ink-muted italic pl-9">No {t(`roles.${role}`).toLowerCase()}s yet</p>
              ) : (
                <div className="space-y-1.5 pl-9">
                  {roleUsers.map((u) => (
                    <GlassCard key={u.id} level={2} className="p-3 flex items-center justify-between border border-slate-100">
                      <span className="text-sm font-semibold text-ink">{u.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${roleColor[role]}`}>{t(`roles.${role}`)}</span>
                        <button
                          onClick={() => deleteUser(u.id, u.name)}
                          className="p-1.5 rounded-lg text-state-danger hover:bg-rose-50 transition active:scale-95"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {showAdd && <AddUserModal factoryId={factoryId} onClose={() => setShowAdd(false)} onAdded={fetchUsers} />}
    </div>
  );
}

function AddUserModal({ factoryId, onClose, onAdded }: { factoryId: string; onClose: () => void; onAdded: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ie" | "chief" | "supervisor">("supervisor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setBusy(true);
    setError(null);

    if (SUPABASE_MODE) {
      const res = await callManageUsers("create", { name: name.trim(), email: email.trim(), password, role, factory_id: factoryId });
      if (res.error) { setError(res.error); setBusy(false); return; }
    }

    setBusy(false);
    setDone(true);
    onAdded();
    setTimeout(() => { setDone(false); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink">Add User to Factory</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Salma Begum"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Role</label>
            <div className="flex gap-2">
              {(["ie", "chief", "supervisor"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border ${
                    role === r ? "bg-brand text-white border-brand shadow-sm" : "bg-slate-50 text-ink border-slate-200 hover:border-brand/40"
                  }`}>
                  {t(`roles.${r}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Email (for login)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@factory.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {error && <p className="text-xs text-state-danger font-medium">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={save} disabled={busy}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition disabled:opacity-50 ${
              done ? "bg-state-success text-white" : "bg-brand text-white"
            }`}>
            {done ? <><Check size={14} /> Created!</> : busy ? "Creating..." : <><Plus size={14} /> Create User</>}
          </button>
        </div>
      </div>
    </div>
  );
}
