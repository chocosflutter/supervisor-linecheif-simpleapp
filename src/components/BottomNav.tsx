import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { BarChart3, Building2, ClipboardCheck, Home, Layers, PlusSquare, Settings, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import type { Role } from "@/types";

interface Tab {
  to: string;
  icon: LucideIcon;
  key: string;
}

const tabsByRole: Record<Role, Tab[]> = {
  super_admin: [
    { to: "/factories", icon: Building2, key: "nav.factories" },
    { to: "/settings", icon: Settings, key: "nav.settings" },
  ],
  supervisor: [
    { to: "/home", icon: Home, key: "nav.home" },
    { to: "/attendance", icon: Users, key: "nav.attendance" },
    { to: "/production", icon: PlusSquare, key: "nav.production" },
    { to: "/performance", icon: BarChart3, key: "nav.performance" },
    { to: "/settings", icon: Settings, key: "nav.settings" },
  ],
  chief: [
    { to: "/home", icon: Home, key: "nav.home" },
    { to: "/performance", icon: BarChart3, key: "nav.performance" },
    { to: "/settings", icon: Settings, key: "nav.settings" },
  ],
  ie: [
    { to: "/home", icon: Home, key: "nav.home" },
    { to: "/load", icon: Layers, key: "nav.loadStyle" },
    { to: "/setup", icon: Wrench, key: "nav.setup" },
    { to: "/audit", icon: ClipboardCheck, key: "nav.audit" },
    { to: "/settings", icon: Settings, key: "nav.settings" },
  ],
};

export default function BottomNav() {
  const { t } = useTranslation();
  const role = useApp((s) => s.user?.role);
  if (!role) return null;
  const tabs = tabsByRole[role];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
      style={{ pointerEvents: "none" }}
    >
      <div className="glass-1 rounded-sheet shadow-glass flex justify-around py-1.5" style={{ pointerEvents: "auto" }}>
        {tabs.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition",
                isActive ? "text-brand" : "text-ink-muted",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium">{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
