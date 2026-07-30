/**
 * Persist ALL mutable store slices to IndexedDB via idb-keyval.
 * On reload (online or offline), the store hydrates from this cache FIRST,
 * then refreshes from Supabase in the background (if online).
 *
 * IMPORTANT: Every slice that the user can see or interact with MUST be here.
 * If it's not persisted, it vanishes on offline reload.
 */
import { get as idbGet, set as idbSet } from "idb-keyval";
import { useApp } from "@/store/appStore";

const STORE_KEY = "rbc-store-cache";
const PERSIST_VERSION = 3; // bumped — adds weeklyOff + holidays

interface PersistedState {
  v: number;
  factories: unknown[];
  units: unknown[];
  floors: unknown[];
  lines: unknown[];
  styles: unknown[];
  lineStyles: unknown[];
  salaryBank: unknown[];
  fxRates: Record<string, number>;
  downtimeReasons: unknown[];
  settings: unknown;
  user: unknown;
  // Production data — previously missing, causing "Not Logged" on offline reload
  attendance: unknown[];
  production: unknown[];
  downtime: unknown[];
  alerts: unknown[];
  weeklyOff: number[];
  holidays: unknown[];
}

/** Save ALL slices to IndexedDB. Called after hydration + on state changes. */
export function persistStore(): void {
  const s = useApp.getState();
  const data: PersistedState = {
    v: PERSIST_VERSION,
    factories: s.factories,
    units: s.units,
    floors: s.floors,
    lines: s.lines,
    styles: s.styles,
    lineStyles: s.lineStyles,
    salaryBank: s.salaryBank,
    fxRates: s.fxRates,
    downtimeReasons: s.downtimeReasons,
    settings: s.settings,
    user: s.user,
    attendance: s.attendance,
    production: s.production,
    downtime: s.downtime,
    alerts: s.alerts,
    weeklyOff: s.weeklyOff,
    holidays: s.holidays,
  };
  void idbSet(STORE_KEY, data);
}

/** Restore persisted state on cold start. Returns true if restored. */
export async function restoreStore(): Promise<boolean> {
  try {
    const data = await idbGet<PersistedState>(STORE_KEY);
    if (!data || data.v !== PERSIST_VERSION) return false;
    useApp.setState({
      factories: data.factories,
      units: data.units,
      floors: data.floors,
      lines: data.lines,
      styles: data.styles,
      lineStyles: data.lineStyles,
      salaryBank: data.salaryBank,
      fxRates: data.fxRates,
      downtimeReasons: data.downtimeReasons,
      settings: data.settings,
      user: data.user,
      attendance: data.attendance ?? [],
      production: data.production ?? [],
      downtime: data.downtime ?? [],
      alerts: data.alerts ?? [],
      weeklyOff: data.weeklyOff ?? [0, 5],
      holidays: data.holidays ?? [],
      hydrated: true,
    } as any);
    return true;
  } catch {
    return false;
  }
}

/** Subscribe to store changes and auto-persist (debounced). */
let timer: ReturnType<typeof setTimeout> | null = null;
export function startAutoPersist(): void {
  useApp.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persistStore, 1000);
  });
}
