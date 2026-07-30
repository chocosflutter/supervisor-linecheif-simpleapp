import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { pendingCount } from "@/offline/outbox";
import { useEffect, useState } from "react";

export default function OnlineBadge() {
  const { t } = useTranslation();
  const online = useApp((s) => s.online);
  const [pending, setPending] = useState(0);

  // Poll pending outbox count every 2s so the user sees sync progress
  useEffect(() => {
    let active = true;
    const poll = () => pendingCount().then((n) => { if (active) setPending(n); });
    poll();
    const id = setInterval(poll, 2000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const label = online
    ? pending > 0 ? `${t("common.online")} · ${pending} syncing` : t("common.online")
    : `${t("common.offline")} — syncing later`;

  return (
    <div
      className="glass-1 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-medium shadow-pill select-none"
      aria-live="polite"
    >
      <span
        className={clsx(
          "h-2.5 w-2.5 rounded-full shrink-0",
          online ? "bg-state-success animate-pulseDot" : "bg-ink-muted",
        )}
      />
      <span className="max-w-[11rem] truncate">{label}</span>
    </div>
  );
}
