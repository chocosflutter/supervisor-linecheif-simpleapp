/**
 * Repository hooks (Phase 0 seam).
 *
 * Screens use these instead of reading the store's data or calling `kpi.ts`
 * directly. Query keys are structured so Phase 2 can cache/invalidate precisely.
 */
import { useQuery } from "@tanstack/react-query";
import { repository } from "@/data/activeRepository";
import type { KpiQuery, KpiGroup } from "@/data/repository";
import type { Kpis } from "@/lib/kpi";
import { emptyKpis } from "@/lib/kpi";
import { useApp } from "@/store/appStore";

/** True when the store is ready to serve real IDs (mock: always; supabase: after hydration). */
function useHydrated() {
  return useApp((s) => s.hydrated);
}

export function useKpis(query: KpiQuery) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["kpis", query],
    queryFn: () => repository.getKpis(query),
    placeholderData: emptyKpis(),
    enabled: hydrated && query.lineIds.length > 0,
  });
}

export function useKpisByGroup(groups: KpiGroup[], base?: Omit<KpiQuery, "lineIds">) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["kpisByGroup", groups, base ?? {}],
    queryFn: () => repository.getKpisByGroup(groups, base),
    placeholderData: {} as Record<string, Kpis>,
    enabled: hydrated && groups.length > 0,
  });
}

export function useProducedSeries(lineIds: string[], date: string) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["producedSeries", lineIds, date],
    queryFn: () => repository.getProducedSeries(lineIds, date),
    placeholderData: [] as number[],
    enabled: hydrated && lineIds.length > 0,
  });
}

export function useStructure() {
  return useQuery({
    queryKey: ["structure"],
    queryFn: () => repository.getStructure(),
  });
}

export function useHourly(lineId: string, date: string) {
  return useQuery({
    queryKey: ["hourly", lineId, date],
    queryFn: () => repository.getHourly(lineId, date),
  });
}

export function useActiveLineStyle(lineId: string) {
  return useQuery({
    queryKey: ["activeLineStyle", lineId],
    queryFn: () => repository.getActiveLineStyle(lineId),
  });
}

export function useDowntime(lineId: string, date: string) {
  return useQuery({
    queryKey: ["downtime", lineId, date],
    queryFn: () => repository.getDowntime(lineId, date),
    placeholderData: [],
  });
}

export function useDowntimeReasons(factoryId: string) {
  return useQuery({
    queryKey: ["downtimeReasons", factoryId],
    queryFn: () => repository.getDowntimeReasons(factoryId),
    placeholderData: [],
  });
}

export function useDailyTrend(lineIds: string[], startDate: string, endDate: string) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["dailyTrend", lineIds, startDate, endDate],
    queryFn: () => repository.getDailyTrend(lineIds, startDate, endDate),
    placeholderData: [],
    enabled: hydrated && lineIds.length > 0,
  });
}
