/**
 * SupabaseRepository — Phase 4 live implementation of the `Repository` seam.
 *
 * KPIs come from the single SECURITY DEFINER RPC `get_line_kpis` (one call →
 * one additive-aggregate row per accessible line); the client sums per group and
 * runs the unchanged `deriveKpis`. Everything else is an RLS-scoped direct select.
 * Line styles are read via `line_styles_v` so CM is masked for supervisors.
 *
 * Requires an authenticated Supabase session (RLS). With no session, RLS returns
 * empty results — the app defaults to the mock repo until auth is wired.
 */
import { supabase } from "@/lib/supabase";
import { resolveDateRange } from "@/lib/dates";
import { deriveKpis, sumAggregates } from "@/lib/kpi";
import type { Aggregate, Kpis } from "@/lib/kpi";
import type { Repository, KpiQuery, KpiGroup, StructureData } from "@/data/repository";
import type { DowntimeEvent, DowntimeReason, LineStyle, ProductionHour } from "@/types";

/** get_line_kpis row → kpi.ts Aggregate (Number-coerce; PostgREST may stringify numeric). */
type KpiRow = {
  line_id: string;
  produced_qty: number; good_qty: number; defective_pcs: number; total_defects: number;
  workforce: number; man_hours: number; produced_minutes: number; value_usd: number;
  operating_cost_usd: number; cm_value_usd: number; planned_man_days: number;
  present_man_days: number; downtime_minutes: number;
  changeover_count: number; changeover_total_min: number;
};

function rowToAggregate(r: KpiRow): Aggregate {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    producedQty: n(r.produced_qty),
    goodQty: n(r.good_qty),
    defectivePcs: n(r.defective_pcs),
    totalDefects: n(r.total_defects),
    workforce: n(r.workforce),
    manHours: n(r.man_hours),
    producedMinutes: n(r.produced_minutes),
    valueUsd: n(r.value_usd),
    operatingCostUsd: n(r.operating_cost_usd),
    cmValueUsd: n(r.cm_value_usd),
    plannedManDays: n(r.planned_man_days),
    presentManDays: n(r.present_man_days),
    changeoverTotalMin: n(r.changeover_total_min),
    changeoverCount: n(r.changeover_count),
  };
}

async function fetchKpiRows(lineIds: string[], base?: Omit<KpiQuery, "lineIds">): Promise<KpiRow[]> {
  if (lineIds.length === 0) return [];
  const { start, end } = resolveDateRange(base?.datePreset, base?.startDate, base?.endDate);
  const { data, error } = await supabase.rpc("get_line_kpis", {
    p_line_ids: lineIds,
    p_start: start,
    p_end: end,
    p_filter_style: base?.filterStyleId ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as unknown as KpiRow[];
}

export const supabaseRepository: Repository = {
  async getKpis(query: KpiQuery): Promise<Kpis> {
    const rows = await fetchKpiRows(query.lineIds, query);
    return deriveKpis(sumAggregates(rows.map(rowToAggregate)));
  },

  async getKpisByGroup(groups: KpiGroup[], base?: Omit<KpiQuery, "lineIds">): Promise<Record<string, Kpis>> {
    const allIds = [...new Set(groups.flatMap((g) => g.lineIds))];
    const rows = await fetchKpiRows(allIds, base);
    const byLine = new Map(rows.map((r) => [r.line_id, rowToAggregate(r)]));
    const out: Record<string, Kpis> = {};
    for (const g of groups) {
      const aggs = g.lineIds.map((id) => byLine.get(id)).filter((a): a is Aggregate => Boolean(a));
      out[g.id] = deriveKpis(sumAggregates(aggs));
    }
    return out;
  },

  async getProducedSeries(lineIds: string[], date: string): Promise<number[]> {
    if (lineIds.length === 0) return [];
    const { data, error } = await supabase
      .from("production_hourly")
      .select("hour_slot, good_qty, defective_pcs")
      .in("line_id", lineIds)
      .eq("date", date);
    if (error) throw error;
    const slots = new Map<string, number>();
    (data ?? []).forEach((p) =>
      slots.set(p.hour_slot, (slots.get(p.hour_slot) ?? 0) + p.good_qty + p.defective_pcs)
    );
    return [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  },

  async getStructure(): Promise<StructureData> {
    const [f, u, fl, l] = await Promise.all([
      supabase.from("factories").select("id,name,code,city,active"),
      supabase.from("units").select("id,name_en,name_bn"),
      supabase.from("floors").select("id,unit_id,name_en,name_bn"),
      supabase.from("lines").select("id,floor_id,name_en,name_bn"),
    ]);
    if (f.error) throw f.error;
    if (u.error) throw u.error;
    if (fl.error) throw fl.error;
    if (l.error) throw l.error;
    return {
      factories: (f.data ?? []).map((x) => ({
        id: x.id, name: x.name, code: x.code, city: x.city ?? undefined, active: x.active,
      })),
      units: (u.data ?? []).map((x) => ({ id: x.id, name_en: x.name_en, name_bn: x.name_bn })),
      floors: (fl.data ?? []).map((x) => ({ id: x.id, unitId: x.unit_id, name_en: x.name_en, name_bn: x.name_bn })),
      lines: (l.data ?? []).map((x) => ({ id: x.id, floorId: x.floor_id, name_en: x.name_en, name_bn: x.name_bn })),
    };
  },

  async getHourly(lineId: string, date: string): Promise<ProductionHour[]> {
    const { data, error } = await supabase
      .from("production_hourly")
      .select("id,line_id,style_id,date,hour_slot,good_qty,defective_pcs,total_defects,entered_at")
      .eq("line_id", lineId)
      .eq("date", date)
      .order("hour_slot");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      lineId: p.line_id,
      styleId: p.style_id,
      date: p.date,
      hourSlot: p.hour_slot,
      goodQty: p.good_qty,
      defectivePcs: p.defective_pcs,
      totalDefects: p.total_defects,
      enteredAt: p.entered_at,
    }));
  },

  async getActiveLineStyle(lineId: string): Promise<LineStyle | undefined> {
    const { data, error } = await supabase
      .from("line_styles_v")
      .select("id,line_id,style_id,cm_per_pc_usd,smv,status,loaded_at,unloaded_at")
      .eq("line_id", lineId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: data.id as string,
      lineId: data.line_id as string,
      styleId: data.style_id as string,
      cmPerPcUsd: Number(data.cm_per_pc_usd ?? 0), // null (masked) for supervisors → 0
      smv: Number(data.smv ?? 0),
      loadedAt: data.loaded_at as string,
      unloadedAt: (data.unloaded_at as string | null) ?? undefined,
      status: data.status as LineStyle["status"],
    };
  },

  async getDowntime(lineId: string, date: string): Promise<DowntimeEvent[]> {
    const { data, error } = await supabase
      .from("downtime_events")
      .select("id,line_id,date,start_time,end_time,reason_id,note,entered_by,created_at")
      .eq("line_id", lineId)
      .eq("date", date);
    if (error) throw error;
    return (data ?? []).map((d) => ({
      id: d.id,
      lineId: d.line_id,
      date: d.date,
      startTime: d.start_time,
      endTime: d.end_time,
      reasonId: d.reason_id,
      note: d.note ?? undefined,
      enteredBy: d.entered_by ?? "",
      enteredAt: d.created_at,
    }));
  },

  async getDowntimeReasons(factoryId: string): Promise<DowntimeReason[]> {
    const { data, error } = await supabase
      .from("downtime_reasons")
      .select("id,factory_id,label,active")
      .eq("factory_id", factoryId)
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, factoryId: r.factory_id, label: r.label, active: r.active }));
  },

  async getDailyTrend(lineIds: string[], startDate: string, endDate: string) {
    if (lineIds.length === 0) return [];
    const { data, error } = await supabase
      .from("line_day_agg")
      .select("date,good_qty,produced_qty,produced_minutes,cm_value_usd,defective_pcs,total_defects")
      .in("line_id", lineIds)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");
    if (error) throw error;
    // Group by date (sum across lines)
    const byDate = new Map<string, { goodQty: number; producedQty: number; producedMinutes: number; workforce: number; manHours: number; cmValueUsd: number; defectivePcs: number; totalDefects: number }>();
    for (const r of data ?? []) {
      const d = byDate.get(r.date) ?? { goodQty: 0, producedQty: 0, producedMinutes: 0, workforce: 0, manHours: 0, cmValueUsd: 0, defectivePcs: 0, totalDefects: 0 };
      d.goodQty += Number(r.good_qty ?? 0);
      d.producedQty += Number(r.produced_qty ?? 0);
      d.producedMinutes += Number(r.produced_minutes ?? 0);
      d.cmValueUsd += Number(r.cm_value_usd ?? 0);
      d.defectivePcs += Number(r.defective_pcs ?? 0);
      d.totalDefects += Number(r.total_defects ?? 0);
      byDate.set(r.date, d);
    }
    return [...byDate.entries()].map(([date, d]) => ({ date, ...d }));
  },
};
