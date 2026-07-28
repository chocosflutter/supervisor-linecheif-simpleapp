import { ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { useApp } from "@/store/appStore";
import type { IeAlert } from "@/types";

/**
 * Renders the alert conversation for a single flagged entry.
 * Open alerts show in amber (awaiting supervisor). Resolved alerts show in
 * green with the supervisor's correction note — this is how the IE sees
 * what the supervisor changed in response.
 */
export default function AlertThread({
  alerts,
  openLabel = "Active Alert Raised to Supervisor",
}: {
  alerts: IeAlert[];
  openLabel?: string;
}) {
  const lang = useApp((s) => s.lang);
  if (alerts.length === 0) return null;

  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status === "resolved");

  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  return (
    <div className="space-y-1.5">
      {open.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-1">
          <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
            <ShieldAlert size={12} />
            {openLabel}
          </span>
          {open.map((alt) => (
            <p key={alt.id} className="text-[11px] text-amber-900 font-medium pl-3">
              • "{alt.note}"
            </p>
          ))}
        </div>
      )}

      {resolved.map((alt) => (
        <div key={alt.id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
            <CheckCircle2 size={12} />
            Resolved by {alt.resolvedBy}
          </span>
          <p className="text-[11px] text-emerald-900/80 font-medium pl-3">
            Flagged: "{alt.note}"
          </p>
          {alt.resolutionNote && (
            <p className="text-[11px] text-emerald-900 font-semibold pl-3">
              Fix: "{alt.resolutionNote}"
            </p>
          )}
          {alt.resolvedAt && (
            <span className="text-[10px] text-emerald-700 flex items-center gap-1 pl-3">
              <Clock size={10} /> {fmt(alt.resolvedAt)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
