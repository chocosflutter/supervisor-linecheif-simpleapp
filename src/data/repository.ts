/**
 * Repository seam (Phase 0).
 *
 * Screens/components talk to this async interface ONLY — never to the Zustand
 * store's raw data or `kpi.ts` directly. Today it is backed by `MockRepository`
 * (in-memory mock). In Phase 2 the same interface is re-implemented against
 * Supabase (`SupabaseRepository`) with NO changes to the consuming screens.
 *
 * Keep every method async (Promise-returning) so the contract already matches
 * the eventual network-backed implementation.
 */
import type { Kpis } from "@/lib/kpi";
import type {
  DowntimeEvent,
  DowntimeReason,
  Factory,
  Floor,
  Line,
  LineStyle,
  ProductionHour,
  Unit,
} from "@/types";

/** Everything needed to resolve a KPI request at any drill level. */
export interface KpiQuery {
  lineIds: string[];
  datePreset?: string; // "today" | "yesterday" | "last7" | "last30" | "custom" | ISO date
  startDate?: string;
  endDate?: string;
  filterStyleId?: string;
}

export interface StructureData {
  factories: Factory[];
  units: Unit[];
  floors: Floor[];
  lines: Line[];
}

/** One drill-comparison group (a unit / floor / line and the lines beneath it). */
export interface KpiGroup {
  id: string;
  lineIds: string[];
}

export interface Repository {
  /** Aggregated KPIs for a set of lines over a date range. */
  getKpis(query: KpiQuery): Promise<Kpis>;

  /**
   * Aggregated KPIs for MANY groups in ONE call (drill comparison charts).
   * Avoids the N+1 pattern of calling getKpis per child. In Phase 2 this is a
   * single grouped RPC.
   */
  getKpisByGroup(groups: KpiGroup[], base?: Omit<KpiQuery, "lineIds">): Promise<Record<string, Kpis>>;

  /** Today's produced-qty-per-slot series (for sparklines / hourly charts). */
  getProducedSeries(lineIds: string[], date: string): Promise<number[]>;

  /** Factory hierarchy (small, cacheable lookup). */
  getStructure(): Promise<StructureData>;

  /** Raw hourly rows for ONE line/day (entry screen + hourly trend only). */
  getHourly(lineId: string, date: string): Promise<ProductionHour[]>;

  /** The currently active (running) style-load for a line, if any. */
  getActiveLineStyle(lineId: string): Promise<LineStyle | undefined>;

  /** Downtime events for one line/day. */
  getDowntime(lineId: string, date: string): Promise<DowntimeEvent[]>;

  /** Active downtime reasons for a factory (dropdown source). */
  getDowntimeReasons(factoryId: string): Promise<DowntimeReason[]>;

  /** Daily KPI trend: one row per date for a set of lines (summed across lines). */
  getDailyTrend(lineIds: string[], startDate: string, endDate: string): Promise<{ date: string; goodQty: number; producedQty: number; producedMinutes: number; valueUsd: number; cmValueUsd: number; defectivePcs: number; totalDefects: number; slots: number }[]>;
}
