/**
 * React Query client + mock-data invalidation bridge (Phase 0).
 *
 * Because the mock repository reads from the Zustand store, we invalidate the
 * query cache whenever any data slice changes (by reference). This keeps the
 * React-Query-backed screens reactive exactly like the old direct store reads.
 * In Phase 2 this bridge is replaced by Supabase realtime + targeted
 * invalidation; the query keys stay the same.
 */
import { QueryClient } from "@tanstack/react-query";
import { useApp } from "@/store/appStore";
import { get as idbGet, set as idbSet } from "idb-keyval";

const QUERY_CACHE_KEY = "rbc-query-cache";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: don't refetch if data is fresh
      gcTime: 24 * 60 * 60 * 1000, // keep cache for 24h (offline survival)
      refetchOnWindowFocus: false,
      retry: (_failureCount) => {
        if (!navigator.onLine) return false;
        return _failureCount < 2;
      },
      networkMode: "offlineFirst",
    },
  },
});

/** Persist the React Query cache to IndexedDB so KPI data survives offline reload. */
export async function persistQueryCache(): Promise<void> {
  const cache = queryClient.getQueryCache().getAll();
  const serializable = cache
    .filter((q) => q.state.status === "success" && q.state.data !== undefined)
    .map((q) => ({ queryKey: q.queryKey, data: q.state.data, dataUpdatedAt: q.state.dataUpdatedAt }));
  await idbSet(QUERY_CACHE_KEY, serializable);
}

/** Restore React Query cache from IndexedDB on cold start. */
export async function restoreQueryCache(): Promise<void> {
  try {
    const cached = await idbGet<Array<{ queryKey: unknown[]; data: unknown; dataUpdatedAt: number }>>(QUERY_CACHE_KEY);
    if (!cached) return;
    for (const entry of cached) {
      queryClient.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.dataUpdatedAt });
    }
  } catch { /* ignore */ }
}

/** The store slices that feed KPI / structure / entry queries. */
function dataSlices(s: ReturnType<typeof useApp.getState>) {
  return [
    s.production,
    s.attendance,
    s.lineStyles,
    s.salaryBank,
    s.settings,
    s.factories,
    s.units,
    s.floors,
    s.lines,
    s.downtime,
    s.downtimeReasons,
  ] as const;
}

let prev: ReturnType<typeof dataSlices> | null = null;

/** Subscribe once; invalidate all queries when any data slice reference changes. */
export function bridgeStoreToQueryCache() {
  prev = dataSlices(useApp.getState());
  useApp.subscribe((state) => {
    const next = dataSlices(state);
    const changed = prev === null || next.some((v, i) => v !== prev![i]);
    if (changed) {
      prev = next;
      queryClient.invalidateQueries();
    }
  });
}
