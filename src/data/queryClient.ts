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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

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
