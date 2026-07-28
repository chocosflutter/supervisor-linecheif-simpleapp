/**
 * Phase 6 — Scoped Supabase Realtime subscriptions.
 *
 * Rules (from the plan):
 * - Subscribe ONLY to the narrow slice on screen (supervisor's own line, today).
 * - On event, INVALIDATE the relevant React Query key (don't stream rows).
 * - Big rollups (factory/unit) use poll/refetch-on-focus, not live subs.
 * - Payloads never carry cm_per_pc_usd (it's in a separate RLS table).
 *
 * Call `subscribeToLine(lineId)` when a supervisor opens their line home;
 * call the returned cleanup on unmount / line switch.
 */
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/data/queryClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

let activeChannel: RealtimeChannel | null = null;

/**
 * Subscribe to production_hourly + attendance changes for one line.
 * Returns a cleanup function to remove the subscription.
 */
export function subscribeToLine(lineId: string): () => void {
  // Tear down previous if any (one active sub at a time for the supervisor).
  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  const channel = supabase
    .channel(`line-${lineId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "production_hourly", filter: `line_id=eq.${lineId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: ["kpis"] });
        void queryClient.invalidateQueries({ queryKey: ["kpisByGroup"] });
        void queryClient.invalidateQueries({ queryKey: ["producedSeries"] });
        void queryClient.invalidateQueries({ queryKey: ["hourly", lineId] });
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attendance", filter: `line_id=eq.${lineId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: ["kpis"] });
        void queryClient.invalidateQueries({ queryKey: ["kpisByGroup"] });
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "downtime_events", filter: `line_id=eq.${lineId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: ["downtime", lineId] });
        void queryClient.invalidateQueries({ queryKey: ["kpis"] });
      }
    )
    .subscribe();

  activeChannel = channel;

  return () => {
    void supabase.removeChannel(channel);
    if (activeChannel === channel) activeChannel = null;
  };
}

/** Unsubscribe from any active channel (e.g. on logout). */
export function unsubscribeAll(): void {
  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
