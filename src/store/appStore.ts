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
import { enqueue, enqueueTable, flush, setOnConfigSynced } from "@/offline/outbox";
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
    const [facR, unR, flR, lnR, stR, drR, fxR, lsR, sbR, thR, asR, bsR, alR, scR] = await Promise.all([
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
      supabase.from("break_slots").select("id,name,type,unit_id,floor_id,start_time,end_time,duration_minutes"),
      supabase.from("alerts").select("id,line_id,category,note,entry_ref,raised_by_name,raised_at,status,resolved_by_name,resolved_at,resolution_note").order("raised_at", { ascending: false }).limit(200),
      supabase.from("shift_config").select("shift_start,shift_end").limit(1).maybeSingle(),
    ]);
    // Log errors for debugging (won't block hydration)
    [facR,unR,flR,lnR,stR,drR,fxR,lsR,sbR,thR,asR,bsR,alR,scR].forEach((r,i) => {
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
    // Break slots (map DB rows → BreakSlot; null unit/floor → "all")
    const breaks: BreakSlot[] = (bsR.data ?? []).map((b) => ({
      id: b.id as string,
      name: (b.name as string) ?? "",
      type: b.type as BreakSlot["type"],
      unitId: (b.unit_id as string | null) ?? "all",
      floorId: (b.floor_id as string | null) ?? "all",
      startTime: (b.start_time as string)?.slice(0, 5) ?? "",
      endTime: (b.end_time as string)?.slice(0, 5) ?? "",
      durationMinutes: Number(b.duration_minutes ?? 0),
    }));
    // Alerts (IE ↔ supervisor notifications; RLS scopes to accessible lines)
    const alerts: IeAlert[] = (alR.data ?? []).map((a) => ({
      id: a.id as string,
      lineId: a.line_id as string,
      category: a.category as IeAlert["category"],
      entryRef: (a.entry_ref as string | null) ?? undefined,
      note: (a.note as string | null) ?? "",
      raisedBy: (a.raised_by_name as string | null) ?? "IE",
      raisedAt: a.raised_at as string,
      status: a.status as IeAlert["status"],
      resolvedBy: (a.resolved_by_name as string | null) ?? undefined,
      resolvedAt: (a.resolved_at as string | null) ?? undefined,
      resolutionNote: (a.resolution_note as string | null) ?? undefined,
    }));
    // App settings (display currency + shift times from DB)
    const displayCurrency = (asR.data?.[0]?.display_currency as "INR" | "BDT") ?? get().settings.displayCurrency;
    const shiftStart = (scR.data?.shift_start as string)?.slice(0, 5) ?? get().settings.shift.start;
    const shiftEnd = (scR.data?.shift_end as string)?.slice(0, 5) ?? get().settings.shift.end;
    const settings = {
      ...get().settings,
      displayCurrency,
      thresholds: thresholds.length > 0 ? thresholds : get().settings.thresholds,
      shift: {
        start: shiftStart,
        end: shiftEnd,
        breaks: breaks.length > 0 ? breaks : get().settings.shift.breaks,
      },
    };
    set({ factories, units, floors, lines, styles, lineStyles, salaryBank, downtimeReasons, fxRates: fxMap, settings, alerts, hydrated: true });
  },

  addFactory: (factory) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : factory.id;
    set((s) => ({ factories: [...s.factories, { ...factory, id }] }));
    if (SUPABASE_MODE) {
      void enqueueTable("factories", "insert", {
        id, name: factory.name, code: factory.code, city: factory.city ?? null, active: factory.active,
      });
    }
  },
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
  addDowntimeReason: (reason) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : reason.id;
    set((s) => ({ downtimeReasons: [...s.downtimeReasons, { ...reason, id }] }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId ?? reason.factoryId;
      if (factoryId) {
        void enqueueTable("downtime_reasons", "insert", {
          id, factory_id: factoryId, label: reason.label, active: reason.active,
        });
      }
    }
  },
  toggleDowntimeReason: (id) => {
    const current = get().downtimeReasons.find((r) => r.id === id);
    set((s) => ({
      downtimeReasons: s.downtimeReasons.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r
      ),
    }));
    if (SUPABASE_MODE && current) {
      // id is either a real server UUID (from hydrate) or a client-minted UUID (from addDowntimeReason above)
      void enqueueTable("downtime_reasons", "update", { active: !current.active }, { id });
    }
  },

  setLang: (lang) => {
    localStorage.setItem("lang", lang);
    i18n.changeLanguage(lang);
    set({ lang });
  },
  setOnline: (online) => {
    set({ online });
    // On reconnect: push any queued local writes FIRST, then pull server truth.
    // Order matters — hydrating before flushing would clobber unsynced edits.
    if (online && SUPABASE_MODE && get().user) {
      void (async () => {
        await flush(); // drain the outbox (production + config) to the server
        await get().hydrateFromSupabase(); // then re-pull authoritative state
        const { queryClient } = await import("@/data/queryClient");
        queryClient.invalidateQueries();
      })();
    }
  },
  toggleLite: () => {
    const lite = !get().lite;
    localStorage.setItem("lite", lite ? "1" : "0");
    set({ lite });
  },
  updateSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId && patch.displayCurrency) {
        void enqueueTable(
          "app_settings",
          "update",
          { display_currency: patch.displayCurrency },
          { factory_id: factoryId },
        );
      }
      if (factoryId && patch.shift) {
        void enqueueTable(
          "shift_config",
          "update",
          { shift_start: patch.shift.start, shift_end: patch.shift.end },
          { factory_id: factoryId },
        );
      }
    }
  },

  // Adds are optimistic in BOTH modes: we mint a real UUID client-side so the
  // local row shows immediately (even offline) and matches the server row id
  // once the queued insert flushes — no duplicate, seamless reconcile on hydrate.
  addUnit: (unit) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : unit.id;
    set((s) => ({ units: [...s.units, { ...unit, id }] }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void enqueueTable("units", "insert", {
          id, factory_id: factoryId, name_en: unit.name_en, name_bn: unit.name_bn,
        });
      }
    }
  },
  addFloor: (floor) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : floor.id;
    set((s) => ({ floors: [...s.floors, { ...floor, id }] }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        void enqueueTable("floors", "insert", {
          id, factory_id: factoryId, unit_id: floor.unitId, name_en: floor.name_en, name_bn: floor.name_bn,
        });
      }
    }
  },
  addLine: (line) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : line.id;
    set((s) => ({ lines: [...s.lines, { ...line, id }] }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      const floor = get().floors.find((f) => f.id === line.floorId);
      if (factoryId && floor) {
        void enqueueTable("lines", "insert", {
          id, factory_id: factoryId, floor_id: line.floorId, unit_id: floor.unitId,
          name_en: line.name_en, name_bn: line.name_bn,
        });
      }
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
    if (SUPABASE_MODE) void enqueue("DELETE_UNIT", { id });
  },
  deleteFloor: (id) => {
    set((s) => ({
      floors: s.floors.filter((f) => f.id !== id),
      lines: s.lines.filter((l) => l.floorId !== id),
    }));
    if (SUPABASE_MODE) void enqueue("DELETE_FLOOR", { id });
  },
  deleteLine: (id) => {
    set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
    if (SUPABASE_MODE) void enqueue("DELETE_LINE", { id });
  },
  addBreakSlot: (b) => {
    const id = SUPABASE_MODE ? crypto.randomUUID() : b.id;
    set((s) => ({
      settings: {
        ...s.settings,
        shift: {
          ...s.settings.shift,
          breaks: [...(s.settings.shift.breaks || []), { ...b, id }],
        },
      },
    }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      if (factoryId) {
        const asUuid = (v?: string) => (v && v !== "all" ? v : null);
        void enqueueTable("break_slots", "insert", {
          id, factory_id: factoryId, name: b.name, type: b.type,
          unit_id: asUuid(b.unitId), floor_id: asUuid(b.floorId),
          start_time: b.startTime, end_time: b.endTime, duration_minutes: b.durationMinutes,
        });
      }
    }
  },
  deleteBreakSlot: (id) => {
    set((s) => ({
      settings: {
        ...s.settings,
        shift: {
          ...s.settings.shift,
          breaks: (s.settings.shift.breaks || []).filter((b) => b.id !== id),
        },
      },
    }));
    if (SUPABASE_MODE) void enqueueTable("break_slots", "delete", {}, { id });
  },
  updateSalaryBankEntry: (entry) => {
    set((s) => ({
      salaryBank: s.salaryBank.map((x) => (x.workerClass === entry.workerClass ? entry : x)),
    }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      const currency = get().settings.displayCurrency;
      const rate = get().fxRates[currency] ?? 1;
      if (factoryId) {
        void enqueueTable(
          "salary_bank",
          "update",
          {
            monthly_salary_usd: entry.monthlySalaryUsd,
            working_days: entry.workingDays,
            standard_hours: entry.standardHours,
            original_amount: entry.monthlySalaryUsd * rate,
            original_currency: currency,
            conversion_rate_at_entry: rate,
          },
          { factory_id: factoryId, worker_class: entry.workerClass },
        );
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
        void enqueueTable(
          "kpi_thresholds",
          "update",
          { good_min: goodMin, watch_min: watchMin },
          { factory_id: factoryId, kpi },
        );
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
  updateProductionHour: (id, patch) => {
    set((s) => ({
      production: s.production.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    if (SUPABASE_MODE) {
      // The supervisor correction re-submits via the same upsert RPC (keyed on
      // line_id + date + hour_slot), so it overwrites the original entry server-side.
      const updated = get().production.find((p) => p.id === id);
      if (updated) {
        void enqueue("ADD_HOURLY_PRODUCTION", {
          lineId: updated.lineId, styleId: updated.styleId, date: updated.date, hourSlot: updated.hourSlot,
          goodQty: updated.goodQty, defectivePcs: updated.defectivePcs, totalDefects: updated.totalDefects,
        });
      }
    }
  },
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
  endRunningStyle: (lineId) => {
    const now = new Date().toISOString();
    const affected = get().lineStyles.filter(
      (x) => x.lineId === lineId && (!x.unloadedAt || x.status === "active"),
    );
    set((s) => ({
      lineStyles: s.lineStyles.map((x) =>
        x.lineId === lineId && (!x.unloadedAt || x.status === "active")
          ? { ...x, unloadedAt: now, status: "closed" }
          : x
      ),
    }));
    if (SUPABASE_MODE) {
      affected.forEach((x) =>
        void enqueueTable("line_styles", "update", { status: "closed", unloaded_at: now }, { id: x.id }),
      );
    }
  },
  startQueuedStyle: (lineStyleId) => {
    const target = get().lineStyles.find((x) => x.id === lineStyleId);
    const now = new Date().toISOString();
    const toClose = target
      ? get().lineStyles.filter(
          (x) => x.lineId === target.lineId && x.id !== lineStyleId && (!x.unloadedAt || x.status === "active"),
        )
      : [];
    set((s) => {
      if (!target) return {};
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
    });
    if (SUPABASE_MODE && target) {
      void enqueueTable("line_styles", "update", { status: "active", loaded_at: now, unloaded_at: null }, { id: lineStyleId });
      toClose.forEach((x) =>
        void enqueueTable("line_styles", "update", { status: "closed", unloaded_at: now }, { id: x.id }),
      );
    }
  },
  updateLineStyleParams: (id, patch) => {
    set((s) => ({
      lineStyles: s.lineStyles.map((x) =>
        x.id === id ? { ...x, ...patch, editedOnce: true } : x,
      ),
    }));
    if (SUPABASE_MODE) {
      if (patch.smv !== undefined) {
        void enqueueTable("line_styles", "update", { smv: patch.smv }, { id });
      }
      if (patch.cmPerPcUsd !== undefined) {
        const currency = get().settings.displayCurrency;
        const rate = get().fxRates[currency] ?? 1;
        void enqueueTable(
          "line_style_costs",
          "update",
          {
            cm_per_pc_usd: patch.cmPerPcUsd,
            original_cm_amount: patch.cmPerPcUsd * rate,
            original_currency: currency,
            conversion_rate_at_entry: rate,
          },
          { line_style_id: id },
        );
      }
    }
  },
  raiseAlert: (alert) => {
    set((s) => ({ alerts: [alert, ...s.alerts] }));
    if (SUPABASE_MODE) {
      const factoryId = get().user?.factoryId;
      const raisedById = get().user?.id;
      if (factoryId) {
        void enqueueTable("alerts", "insert", {
          id: alert.id,
          factory_id: factoryId,
          line_id: alert.lineId,
          category: alert.category,
          note: alert.note,
          entry_ref: alert.entryRef ?? null,
          raised_by: raisedById ?? null,
          raised_by_name: alert.raisedBy,
          raised_at: alert.raisedAt,
          status: "open",
        });
      }
    }
  },
  resolveAlert: (id, resolutionNote) => {
    const resolvedByName = get().user?.name ?? "Supervisor";
    const resolvedAt = new Date().toISOString();
    const note = resolutionNote.trim();
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id
          ? { ...a, status: "resolved", resolvedBy: resolvedByName, resolvedAt, resolutionNote: note }
          : a
      ),
    }));
    if (SUPABASE_MODE) {
      void enqueueTable(
        "alerts",
        "update",
        {
          status: "resolved",
          resolution_note: note,
          resolved_by: get().user?.id ?? null,
          resolved_by_name: resolvedByName,
          resolved_at: resolvedAt,
        },
        { id },
      );
    }
  },

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

// After config/master writes are flushed to the server, re-pull authoritative
// state (real UUIDs for freshly-inserted rows, canonical values, etc.).
if (SUPABASE_MODE) {
  setOnConfigSynced(() => {
    if (useApp.getState().user) void useApp.getState().hydrateFromSupabase();
  });
}
