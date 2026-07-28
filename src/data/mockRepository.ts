/**
 * MockRepository — Phase 0 implementation of the `Repository` seam.
 *
 * Reads a fresh snapshot from the Zustand store on each call and reuses the
 * pure functions in `kpi.ts`. Methods are async to match the eventual Supabase
 * implementation; React Query invalidation (see `queryClient.ts`) re-runs them
 * whenever the underlying mock data changes.
 */
import { useApp } from "@/store/appStore";
import { computeKpisForLines } from "@/lib/kpi";
import type { DataSet, Kpis } from "@/lib/kpi";
import { plannedHeadcount, styles as seedStyles } from "@/data/mock";
import type { Repository, KpiQuery, KpiGroup, StructureData } from "@/data/repository";
import type { DowntimeEvent, DowntimeReason, LineStyle, ProductionHour } from "@/types";

/** Build the DataSet the KPI engine expects from the live store snapshot. */
function snapshotDataset(): DataSet {
  const s = useApp.getState();
  return {
    production: s.production,
    attendance: s.attendance,
    plannedHeadcount,
    lineStyles: s.lineStyles,
    styles: seedStyles,
    salaryBank: s.salaryBank,
  };
}

export const mockRepository: Repository = {
  async getKpis(query: KpiQuery): Promise<Kpis> {
    const { lineIds, datePreset = "today", startDate, endDate, filterStyleId } = query;
    return computeKpisForLines(lineIds, datePreset, snapshotDataset(), startDate, endDate, filterStyleId);
  },

  async getKpisByGroup(
    groups: KpiGroup[],
    base: Omit<KpiQuery, "lineIds"> = {}
  ): Promise<Record<string, Kpis>> {
    const ds = snapshotDataset();
    const { datePreset = "today", startDate, endDate, filterStyleId } = base;
    const out: Record<string, Kpis> = {};
    for (const g of groups) {
      out[g.id] = computeKpisForLines(g.lineIds, datePreset, ds, startDate, endDate, filterStyleId);
    }
    return out;
  },

  async getProducedSeries(lineIds: string[], date: string): Promise<number[]> {
    const { production } = useApp.getState();
    const slots = new Map<string, number>();
    production
      .filter((p) => lineIds.includes(p.lineId) && p.date === date)
      .forEach((p) => slots.set(p.hourSlot, (slots.get(p.hourSlot) ?? 0) + p.goodQty + p.defectivePcs));
    return [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  },

  async getStructure(): Promise<StructureData> {
    const s = useApp.getState();
    return { factories: s.factories, units: s.units, floors: s.floors, lines: s.lines };
  },

  async getHourly(lineId: string, date: string): Promise<ProductionHour[]> {
    return useApp
      .getState()
      .production.filter((p) => p.lineId === lineId && p.date === date)
      .sort((a, b) => a.hourSlot.localeCompare(b.hourSlot));
  },

  async getActiveLineStyle(lineId: string): Promise<LineStyle | undefined> {
    return useApp
      .getState()
      .lineStyles.find(
        (x) => x.lineId === lineId && !x.unloadedAt && x.status !== "closed" && x.status !== "queued"
      );
  },

  async getDowntime(lineId: string, date: string): Promise<DowntimeEvent[]> {
    return useApp.getState().downtime.filter((d) => d.lineId === lineId && d.date === date);
  },

  async getDowntimeReasons(factoryId: string): Promise<DowntimeReason[]> {
    return useApp.getState().downtimeReasons.filter((r) => r.factoryId === factoryId && r.active);
  },
};
