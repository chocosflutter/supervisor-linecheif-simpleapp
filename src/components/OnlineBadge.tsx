import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";

export default function OnlineBadge() {
  const { t } = useTranslation();
  const online = useApp((s) => s.online);
  const setOnline = useApp((s) => s.setOnline);
  return (
    <button
      onClick={() => setOnline(!online)}
      className="glass-1 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-medium shadow-pill"
      title="Toggle online/offline (mock)"
    >
      <span
        className={clsx(
          "h-2.5 w-2.5 rounded-full",
          online ? "bg-state-success animate-pulseDot" : "bg-ink-muted",
        )}
      />
      <span className="max-w-[9rem] truncate">{online ? t("common.online") : t("common.offline")}</span>
    </button>
  );
}
