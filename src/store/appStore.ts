import { create } from "zustand";
import type {
  AppSettings,
  Attendance,
  DowntimeEvent,
  DowntimeReason,
  Factory,
  IeAlert,
  Lang,
  LineStyle,
  ProductionHour,
  Role,
  Style,
  User,
} from "@/types";
import type { DataSet } from "@/lib/kpi";
import type {
  BreakSlot,
  Floor,
  KpiKey,
  Line,
  SalaryBankEntry,
  Unit,
} from "@/types";
import {
  attendance as seedAttendance,
  defaultSettings,
  downtime as seedDowntime,
  downtimeReasons as seedDowntimeReasons,
  factories as seedFactories,
  floors as seedFloors,
  FX_RATES,
  lineStyles as seedLineStyles,
  lines as seedLines,
  plannedHeadcount,
  production as seedProduction,
  salaryBank as seedSalaryBank,
  styles as seedStyles,
  units as seedUnits,
  users,
} from "@/data/mock";
import i18n from "@/i18n";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { signIn as authSignIn, signOut as authSignOut, loadProfile } from "@/lib/auth";
import { enqueue } from "@/offline/outbox";
import { unsubscribeAll } from "@/realtime/subscribe";

/** True when the app should authenticate against Supabase (vs. mock role-pick). */
export const SUPABASE_MODE =
  supabaseConfigured && import.meta.env.VITE_DATA_SOURCE === "supabase";

interface AppState {
  user: User | null;
  superAdmin: User | null; // remembered while acting-as, so we can return
  lang: Lang;
  online: boolean;
  lite: boolean;
  settings: AppSettings;

  // mutable data (mock; replaced by Supabase in Phase 2)
  factories: Factory[];
  units: Unit[];
  floors: Floor[];
  lines: Line[];
  styles: Style[];
  fxRates: Record<string, number>;
  salaryBank: SalaryBankEntry[];
  attendance: Attendance[];
  production: ProductionHour[];
  lineStyles: LineStyle[];
  alerts: IeAlert[];
  downtimeReasons: DowntimeReason[];
  downtime: DowntimeEvent[];

  // auth
  authReady: boolean; // supabase session resolved (mock mode: always true)
  hydrated: boolean; // supabase structure/data loaded (mock mode: always true)

  // actions
  login: (role: Role) => void;
  logout: () => void;

  // supabase auth (used only in SUPABASE_MODE)
  signIn: (email: string, password: string) => Promise<string | null>; // returns error message or null
  bootstrapAuth: () => void;
  hydrateFromSupabase: () => Promise<void>;

  // super admin (multi-factory)
  addFactory: (factory: Factory) => void;
  actAs: (role: Role, factoryId?: string) => void;
  returnToSuperAdmin: () => void;

  // downtime
  addDowntime: (event: DowntimeEvent) => void;
  addDowntimeReason: (reason: DowntimeReason) => void;
  toggleDowntimeReason: (id: string) => void;
  setLang: (lang: Lang) => void;
  setOnline: (online: boolean) => void;
  toggleLite: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  addUnit: (unit: Unit) => void;
  addFloor: (floor: Floor) => void;
  addLine: (line: Line) => void;
  deleteUnit: (id: string) => void;
  deleteFloor: (id: string) => void;
  deleteLine: (id: string) => void;
  addBreakSlot: (breakSlot: BreakSlot) => void;
  deleteBreakSlot: (id: string) => void;
  updateSalaryBankEntry: (entry: SalaryBankEntry) => void;
  updateThreshold: (kpi: KpiKey, goodMin: number, watchMin: number) => void;

  saveAttendance: (a: Attendance) => void;
  addProductionHour: (p: ProductionHour) => void;
  updateProductionHour: (id: string, patch: Partial<ProductionHour>) => void;
  loadStyle: (ls: LineStyle) => void;
  endRunningStyle: (lineId: string) => void;
  startQueuedStyle: (lineStyleId: string) => void;
  updateLineStyleParams: (id: string, patch: Partial<LineStyle>) => void;
  raiseAlert: (alert: IeAlert) => void;
  resolveAlert: (id: string, resolutionNote: string) => void;

  dataset: () => DataSet;
  hasAttendanceToday: (lineId: string, date: string) => boolean;
}

export const useApp = create<AppState>((set, get) => ({
  user: null,
  superAdmin: null,
  authReady: !SUPABASE_MODE, // mock mode is ready immediately
  hydrated: !SUPABASE_MODE, // mock mode is hydrated immediately
  lang: (localStorage.getItem("lang") as Lang) || "en",
  online: navigator.onLine,
  lite: localStorage.getItem("lite") === "1",
  settings: defaultSettings,

  factories: [...seedFactories],
  units: [...seedUnits],
  floors: [...seedFloors],
  lines: [...seedLines],
  styles: [...seedStyles],
  fxRates: { ...FX_RATES },
  salaryBank: [...seedSalaryBank],
  attendance: [...seedAttendance],
  production: [...seedProduction],
  lineStyles: [...seedLineStyles],
  alerts: [],
  downtimeReasons: [...seedDowntimeReasons],
  downtime: [...seedDowntime],

  login: (role) => {
    const user = users.find((u) => u.role === role) ?? null;
    set({ user, superAdmin: null });
  },
  logout: () => {
    if (SUPABASE_MODE) { unsubscribeAll(); void authSignOut(); }
    set({ user: null, superAdmin: null, hydrated: !SUPABASE_MODE });
  },

  signIn: async (email, password) => {
    const { error } = await authSignIn(email, password);
    if (error) return error.message;
    const profile = await loadProfile();
    if (!profile) return "No profile linked to this account.";
    set({ user: profile, superAdmin: null });
    await get().hydrateFromSupabase();
    return null;
  },
  bootstrapAuth: () => {
    // If offline and we already have a cached user (from IndexedDB restore), don't touch auth.
    if (!navigator.onLine && get().user) {
      set({ authReady: true });
      return;
    }
    // Fires INITIAL_SESSION immediately, then on every auth change.
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await loadProfile();
        set({ user: profile, authReady: true });
        if (profile) await get().hydrateFromSupabase();
      } else {
        // Offline: keep cached user. Online: real sign-out.
        if (navigator.onLine) {
          set({ user: null, authReady: true });
        } else {
          set({ authReady: true });
        }
      }
    });
  },
  hydrateFromSupabase: async () => {
    // Load factory structure, styles, line_styles, FX rates, downtime reasons from DB.
    const [facR, unR, flR, lnR, stR, drR, fxR, lsR, sbR, thR, asR] = await Promise.all([
      supabase.from("factories").select("id,name,code,city,active"),
      supabase.from("units").select("id,factory_id,name_en,name_bn").is("archived_at", null),
      supabase.from("floors").select("id,factory_id,unit_id,name_en,name_bn").is("archived_at", null),
      supabase.from("lines").select("id,factory_id,unit_id,floor_id,name_en,name_bn").is("archived_at", null),
      supabase.from("styles").select("id,factory_id,code,name,value_per_pc_usd"),
      supabase.from("downtime_reasons").select("id,factory_id,label,active"),
      supabase.from("fx_rates").select("currency,rate").order("fetched_at", { ascending: false }).limit(10),
      supabase.from("line_styles_v").select("id,line_id,style_id,cm_per_pc_usd,smv,status,loaded_at,unloaded_at"),
      supabase.from("salary_bank").select("worker_class,monthly_salary_usd,working_days,standard_hours,effective_from").order("effective_from", { ascending: false }),
      supabase.from("kpi_thresholds").select("kpi,good_min,watch_min,direction"),
      supabase.from("app_settings").select("display_currency"),
    ]);
    // Log errors for debugging (won't block hydration)
    [facR,unR,flR,lnR,stR,drR,fxR,lsR,sbR,thR,asR].forEach((r,i) => {
      if (r.error) console.error(`[hydrate] query ${i} error:`, r.error.message);
    });
    const factories = (facR.data ?? []).map((f) => ({
      id: f.id, name: f.name, code: f.code, city: f.city ?? undefined, active: f.active,
    }));
    const units = (unR.data ?? []).map((u) => ({ id: u.id, name_en: u.name_en, name_bn: u.name_bn }));
    const floors = (flR.data ?? []).map((fl) => ({ id: fl.id, unitId: fl.unit_id, name_en: fl.name_en, name_bn: fl.name_bn }));
    const lines = (lnR.data ?? []).map((l) => ({ id: l.id, floorId: l.floor_id, name_en: l.name_en, name_bn: l.name_bn }));
    const styles = (stR.data ?? []).map((s) => ({
      id: s.id, code: s.code, name: s.name, valuePerPcUsd: Number(s.value_per_pc_usd),
    }));
    const downtimeReasons = (drR.data ?? []).map((r) => ({
      id: r.id, factoryId: r.factory_id, label: r.label, active: r.active,
    }));
    const fxMap: Record<string, number> = {};
    const seen = new Set<string>();
    (fxR.data ?? []).forEach((r) => {
      if (!seen.has(r.currency)) { fxMap[r.currency] = Number(r.rate); seen.add(r.currency); }
    });
    const lineStyles: LineStyle[] = (lsR.data ?? []).map((ls) => ({
      id: ls.id as string,
      lineId: ls.line_id as string,
      styleId: ls.style_id as string,
      cmPerPcUsd: Number(ls.cm_per_pc_usd ?? 0),
      smv: Number(ls.smv ?? 0),
      loadedAt: ls.loaded_at as string,
      unloadedAt: (ls.unloaded_at as string | null) ?? undefined,
      status: ls.status as LineStyle["status"],
    }));
    // Salary bank: take the latest effective row per worker class
    const salaryMap = new Map<string, SalaryBankEntry>();
    console.log("[hydrate] salary_bank data:", sbR.data);
    (sbR.data ?? []).forEach((r) => {
      if (!salaryMap.has(r.worker_class)) {
        salaryMap.set(r.worker_class, {
          workerClass: r.worker_class as SalaryBankEntry["workerClass"],
          monthlySalaryUsd: Number(r.monthly_salary_usd),
          workingDays: r.working_days,
          standardHours: r.standard_hours,
        });
      }
    });
    const salaryBank = [...salaryMap.values()];
    // KPI Thresholds
    const thresholds = (thR.data ?? []).map((t) => ({
      kpi: t.kpi as KpiKey,
      goodMin: Number(t.good_min),
      watchMin: Number(t.watch_min),
      direction: t.direction as "higher_is_better" | "lower_is_better",
    }));
    // App settings (display currency)
    const displayCurrency = (asR.data?.[0]?.display_currency as "INR" | "BDT") ?? get().settings.displayCurrency;
    const settings = { ...get().settings, displayCurrency, thresholds: thresholds.length > 0 ? thresholds : get().settings.thresholds };
    set({ factories, units, floors, lines, styles, lineStyles, salaryBank, downtimeReasons, fxRates: fxMap, settings, hydrated: true });
  },

  addFactory: (factory) => set((s) => ({ factories: [...s.factories, factory] })),
  actAs: (role, factoryId) =>
    set((s) => {
      // Remember the super admin so we can return; synthesize/pick a user of the target role.
      const template = users.find((u) => u.role === role);
      const actingUser: User = template
        ? { ...template, factoryId: factoryId ?? template.factoryId }
        : { id: `acting-${role}`, name: `Acting ${role}`, role, lineIds: [], factoryId };
      return { superAdmin: s.superAdmin ?? s.user, user: actingUser };
    }),
  returnToSuperAdmin: () =>
    set((s) => ({ user: s.superAdmin ?? s.user, superAdmin: null })),

  addDowntime: (event) => {
    set((s) => ({ downtime: [event, ...s.downtime] }));
    if (SUPABASE_MODE)
      void enqueue("ADD_DOWNTIME", {
        lineId: event.lineId, date: event.date, startTime: event.startTime,
        endTime: event.endTime, reasonId: event.reasonId, note: event.note ?? "",
      });
  },
  addDowntimeReason: (reason) =>
    set((s) => ({ downtimeReasons: [...s.downtimeReasons, reason] })),
  toggleDowntimeReason: (id) =>
    set((s) => ({
      downtimeReasons: s.downtimeReasons.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r
      ),
    })),

  setLang: (lang) => {
    localStorage.setItem("lang", lang);
    i18n.changeLanguage(lang);
    set({ lang });
  },
  setOnline: (online) => {
    set({ online });
    // On reconnect: re-hydrate from server to get the latest truth.
    if (online && SUPABASE_MODE && get().user) {
      void get().hydrateFromSupabase();
      void import("@/data/queryClient").then(({ queryClient }) => queryClient.invalidateQueries());
    }
  },
  toggleLite: () => {
    const lite = !get().lite;
    localStorage.setItem("lite", lite ? "1" : "0");
    set({ lite });
  },
  updateSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    if (SUPABASE_MODE && patch.displayCurrency) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void supabase.from("app_settings")
          .update({ display_currency: patch.displayCurrency })
          .eq("factory_id", factoryId);
      }
    }
  },

  addUnit: (unit) => {
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void supabase.from("units").insert({ factory_id: factoryId, name_en: unit.name_en, name_bn: unit.name_bn })
          .then(() => get().hydrateFromSupabase());
      }
    } else {
      set((s) => ({ units: [...s.units, unit] }));
    }
  },
  addFloor: (floor) => {
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void supabase.from("floors").insert({ factory_id: factoryId, unit_id: floor.unitId, name_en: floor.name_en, name_bn: floor.name_bn })
          .then(() => get().hydrateFromSupabase());
      }
    } else {
      set((s) => ({ floors: [...s.floors, floor] }));
    }
  },
  addLine: (line) => {
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      const floor = get().floors.find((f) => f.id === line.floorId);
      if (factoryId && floor) {
        void supabase.from("lines").insert({
          factory_id: factoryId, floor_id: line.floorId, unit_id: floor.unitId,
          name_en: line.name_en, name_bn: line.name_bn,
        }).then(() => get().hydrateFromSupabase());
      }
    } else {
      set((s) => ({ lines: [...s.lines, line] }));
    }
  },
  deleteUnit: (id) => {
    set((s) => {
      const floorIdsToRemove = s.floors.filter((f) => f.unitId === id).map((f) => f.id);
      return {
        units: s.units.filter((u) => u.id !== id),
        floors: s.floors.filter((f) => f.unitId !== id),
        lines: s.lines.filter((l) => !floorIdsToRemove.includes(l.floorId)),
      };
    });
    if (SUPABASE_MODE) void supabase.from("units").update({ archived_at: new Date().toISOString() }).eq("id", id)
      .then(() => get().hydrateFromSupabase());
  },
  deleteFloor: (id) => {
    set((s) => ({
      floors: s.floors.filter((f) => f.id !== id),
      lines: s.lines.filter((l) => l.floorId !== id),
    }));
    if (SUPABASE_MODE) void supabase.from("floors").update({ archived_at: new Date().toISOString() }).eq("id", id)
      .then(() => get().hydrateFromSupabase());
  },
  deleteLine: (id) => {
    set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
    if (SUPABASE_MODE) void supabase.from("lines").update({ archived_at: new Date().toISOString() }).eq("id", id)
      .then(() => get().hydrateFromSupabase());
  },
  addBreakSlot: (b) =>
    set((s) => ({
      settings: {
        ...s.settings,
        shift: {
          ...s.settings.shift,
          breaks: [...(s.settings.shift.breaks || []), b],
        },
      },
    })),
  deleteBreakSlot: (id) =>
    set((s) => ({
      settings: {
        ...s.settings,
        shift: {
          ...s.settings.shift,
          breaks: (s.settings.shift.breaks || []).filter((b) => b.id !== id),
        },
      },
    })),
  updateSalaryBankEntry: (entry) => {
    set((s) => ({
      salaryBank: s.salaryBank.map((x) => (x.workerClass === entry.workerClass ? entry : x)),
    }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      const currency = get().settings.displayCurrency;
      const rate = get().fxRates[currency] ?? 1;
      if (factoryId) {
        void supabase.from("salary_bank")
          .update({
            monthly_salary_usd: entry.monthlySalaryUsd,
            working_days: entry.workingDays,
            standard_hours: entry.standardHours,
            original_amount: entry.monthlySalaryUsd * rate,
            original_currency: currency,
            conversion_rate_at_entry: rate,
          })
          .eq("factory_id", factoryId)
          .eq("worker_class", entry.workerClass)
          .then(() => get().hydrateFromSupabase());
      }
    }
  },
  updateThreshold: (kpi, goodMin, watchMin) => {
    set((s) => ({
      settings: {
        ...s.settings,
        thresholds: s.settings.thresholds.map((t) =>
          t.kpi === kpi ? { ...t, goodMin, watchMin } : t
        ),
      },
    }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void supabase.from("kpi_thresholds")
          .update({ good_min: goodMin, watch_min: watchMin })
          .eq("factory_id", factoryId)
          .eq("kpi", kpi);
      }
    }
  },

  saveAttendance: (a) => {
    set((s) => ({
      attendance: [...s.attendance.filter((x) => !(x.lineId === a.lineId && x.date === a.date)), a],
    }));
    if (SUPABASE_MODE)
      void enqueue("SAVE_ATTENDANCE", {
        lineId: a.lineId, date: a.date,
        operators: a.operators, helpers: a.helpers, pressmen: a.pressmen, checkers: a.checkers,
      });
  },
  addProductionHour: (p) => {
    set((s) => ({ production: [...s.production, p] }));
    if (SUPABASE_MODE)
      void enqueue("ADD_HOURLY_PRODUCTION", {
        lineId: p.lineId, styleId: p.styleId, date: p.date, hourSlot: p.hourSlot,
        goodQty: p.goodQty, defectivePcs: p.defectivePcs, totalDefects: p.totalDefects,
      });
  },
  updateProductionHour: (id, patch) =>
    set((s) => ({
      production: s.production.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  loadStyle: (ls) => {
    set((s) => {
      const hasActive = s.lineStyles.some((x) => x.lineId === ls.lineId && !x.unloadedAt && x.status !== "closed" && x.status !== "queued");
      const newLs: LineStyle = {
        ...ls,
        status: hasActive ? "queued" : "active",
      };
      return {
        lineStyles: [...s.lineStyles, newLs],
      };
    });
    if (SUPABASE_MODE) {
      const currency = get().settings.displayCurrency;
      const rate = get().fxRates[currency] ?? 1;
      void enqueue("LOAD_STYLE", {
        lineId: ls.lineId, styleId: ls.styleId, smv: ls.smv, cmPerPcUsd: ls.cmPerPcUsd,
        styleName: get().styles.find((s) => s.id === ls.styleId)?.name ?? "",
        styleCode: get().styles.find((s) => s.id === ls.styleId)?.code ?? "",
        originalCmAmount: ls.cmPerPcUsd * rate,
        originalCurrency: currency,
        conversionRateAtEntry: rate,
      });
    }
  },
  endRunningStyle: (lineId) =>
    set((s) => ({
      lineStyles: s.lineStyles.map((x) =>
        x.lineId === lineId && (!x.unloadedAt || x.status === "active")
          ? { ...x, unloadedAt: new Date().toISOString(), status: "closed" }
          : x
      ),
    })),
  startQueuedStyle: (lineStyleId) =>
    set((s) => {
      const target = s.lineStyles.find((x) => x.id === lineStyleId);
      if (!target) return {};
      const now = new Date().toISOString();
      return {
        lineStyles: s.lineStyles.map((x) => {
          if (x.id === lineStyleId) {
            return { ...x, status: "active", loadedAt: now, unloadedAt: undefined };
          }
          if (x.lineId === target.lineId && x.id !== lineStyleId && (!x.unloadedAt || x.status === "active")) {
            return { ...x, unloadedAt: now, status: "closed" };
          }
          return x;
        }),
      };
    }),
  updateLineStyleParams: (id, patch) =>
    set((s) => ({
      lineStyles: s.lineStyles.map((x) =>
        x.id === id ? { ...x, ...patch, editedOnce: true } : x,
      ),
    })),
  raiseAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts] })),
  resolveAlert: (id, resolutionNote) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "resolved",
              resolvedBy: get().user?.name ?? "Supervisor",
              resolvedAt: new Date().toISOString(),
              resolutionNote: resolutionNote.trim(),
            }
          : a
      ),
    })),

  dataset: () => ({
    production: get().production,
    attendance: get().attendance,
    plannedHeadcount,
    lineStyles: get().lineStyles,
    styles: get().styles,
    salaryBank: get().salaryBank,
  }),

  hasAttendanceToday: (lineId, date) =>
    get().attendance.some((a) => a.lineId === lineId && a.date === date),
}));
