import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HardHat, LineChart, Ruler, ShieldCheck, LogIn } from "lucide-react";
import { useApp, SUPABASE_MODE } from "@/store/appStore";
import type { Role } from "@/types";
import GlassCard from "@/components/GlassCard";
import LanguageToggle from "@/components/LanguageToggle";

const roleMeta: { role: Role; icon: typeof HardHat }[] = [
  { role: "super_admin", icon: ShieldCheck },
  { role: "supervisor", icon: HardHat },
  { role: "chief", icon: LineChart },
  { role: "ie", icon: Ruler },
];

/** Mock mode: pick a role to preview (no backend). */
function RolePicker() {
  const { t } = useTranslation();
  const login = useApp((s) => s.login);
  const nav = useNavigate();
  const pick = (role: Role) => {
    login(role);
    nav("/home", { replace: true });
  };
  return (
    <>
      <p className="text-xs text-ink-muted mt-6 mb-3 uppercase tracking-wide">{t("login.chooseRole")}</p>
      <div className="space-y-3">
        {roleMeta.map(({ role, icon: Icon }) => (
          <button
            key={role}
            onClick={() => pick(role)}
            className="w-full glass-solid rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-card hairline-top overflow-hidden"
          >
            <span className="h-11 w-11 rounded-xl bg-brand-100 text-brand grid place-items-center">
              <Icon size={22} />
            </span>
            <span className="text-left font-semibold text-ink">{t(`roles.${role}`)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Supabase mode: real email/password sign-in. */
function EmailLogin() {
  const { t } = useTranslation();
  const signIn = useApp((s) => s.signIn);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
    else nav("/home", { replace: true });
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-6 text-left">
      <div>
        <label className="text-xs font-semibold text-ink-muted block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="w-full bg-white border border-brand/20 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-muted block mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full bg-white border border-brand/20 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          required
        />
      </div>
      {error && <p className="text-xs text-state-danger font-medium">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand text-white font-semibold rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-glass disabled:opacity-60"
      >
        <LogIn size={18} />
        {busy ? t("common.loading") : t("login.continue")}
      </button>
    </form>
  );
}

export default function Login() {
  const { t } = useTranslation();
  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <GlassCard level={3} className="p-6 text-center">
          <img src="/logo.png" alt="RBC" className="h-14 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-ink">{t("app.title")}</h1>
          <p className="text-sm text-ink-muted mt-1">{t("login.subtitle")}</p>
          {SUPABASE_MODE ? <EmailLogin /> : <RolePicker />}
        </GlassCard>
      </div>
    </div>
  );
}
