import { describe, it, expect, beforeEach, vi } from "vitest";
import type { useApp as UseApp } from "./appStore";

/** Capture outbox calls without touching IndexedDB / network. */
const ob = vi.hoisted(() => ({
  enqueue: vi.fn(),
  enqueueTable: vi.fn(),
  flush: vi.fn(async () => {}),
  setOnConfigSynced: vi.fn(),
}));

vi.mock("@/offline/outbox", () => ob);
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { onAuthStateChange: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
  supabaseConfigured: true,
}));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn(), loadProfile: vi.fn() }));
vi.mock("@/realtime/subscribe", () => ({ unsubscribeAll: vi.fn() }));
vi.mock("@/data/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));

let useApp: typeof UseApp;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_DATA_SOURCE", "supabase"); // → SUPABASE_MODE = true
  ({ useApp } = await import("./appStore"));
  useApp.setState({ user: { id: "u", name: "IE", role: "ie", lineIds: [], factoryId: "f1" } });
});

describe("appStore config/master writes route through the outbox", () => {
  it("SUPABASE_MODE is enabled in the test environment", async () => {
    const mod = await import("./appStore");
    expect(mod.SUPABASE_MODE).toBe(true);
  });

  it("updateThreshold → kpi_thresholds update", () => {
    useApp.getState().updateThreshold("productivity", 800, 600);
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "kpi_thresholds",
      "update",
      { good_min: 800, watch_min: 600 },
      { factory_id: "f1", kpi: "productivity" },
    );
  });

  it("updateSettings(currency) → app_settings update", () => {
    useApp.getState().updateSettings({ displayCurrency: "BDT" });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "app_settings",
      "update",
      { display_currency: "BDT" },
      { factory_id: "f1" },
    );
  });

  it("addDowntimeReason → downtime_reasons insert", () => {
    useApp.getState().addDowntimeReason({ id: "dr-x", factoryId: "f1", label: "Thread break", active: true });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "downtime_reasons",
      "insert",
      { factory_id: "f1", label: "Thread break", active: true },
    );
  });

  it("toggleDowntimeReason → downtime_reasons update with negated active", () => {
    useApp.setState({ downtimeReasons: [{ id: "dr1", factoryId: "f1", label: "X", active: true }] });
    useApp.getState().toggleDowntimeReason("dr1");
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "downtime_reasons",
      "update",
      { active: false },
      { id: "dr1" },
    );
  });

  it("addUnit → units insert", () => {
    useApp.getState().addUnit({ id: "u-tmp", name_en: "Unit A", name_bn: "ইউনিট এ" });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "units",
      "insert",
      { factory_id: "f1", name_en: "Unit A", name_bn: "ইউনিট এ" },
    );
  });

  it("addFloor → floors insert", () => {
    useApp.getState().addFloor({ id: "f-tmp", unitId: "u1", name_en: "Floor 1", name_bn: "ফ্লোর ১" });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "floors",
      "insert",
      { factory_id: "f1", unit_id: "u1", name_en: "Floor 1", name_bn: "ফ্লোর ১" },
    );
  });

  it("addLine → lines insert (resolves unit_id from the parent floor)", () => {
    useApp.setState({ floors: [{ id: "fl1", unitId: "u1", name_en: "F", name_bn: "F" }] });
    useApp.getState().addLine({ id: "l-tmp", floorId: "fl1", name_en: "Line 1", name_bn: "লাইন ১" });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "lines",
      "insert",
      { factory_id: "f1", floor_id: "fl1", unit_id: "u1", name_en: "Line 1", name_bn: "লাইন ১" },
    );
  });

  it("deleteUnit → units archived_at update", () => {
    useApp.getState().deleteUnit("u1");
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "units",
      "update",
      expect.objectContaining({ archived_at: expect.any(String) }),
      { id: "u1" },
    );
  });

  it("updateSalaryBankEntry → salary_bank update with conversion snapshot", () => {
    useApp.getState().updateSalaryBankEntry({
      workerClass: "operator",
      monthlySalaryUsd: 120,
      workingDays: 26,
      standardHours: 8,
    });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "salary_bank",
      "update",
      expect.objectContaining({
        monthly_salary_usd: 120,
        working_days: 26,
        standard_hours: 8,
        original_currency: expect.any(String),
        conversion_rate_at_entry: expect.any(Number),
      }),
      { factory_id: "f1", worker_class: "operator" },
    );
  });

  it("addBreakSlot → break_slots insert (maps 'all' to null)", () => {
    useApp.getState().addBreakSlot({
      id: "bs-x", name: "Tea", type: "tea", unitId: "all", floorId: "all",
      startTime: "10:15", endTime: "10:30", durationMinutes: 15,
    });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "break_slots",
      "insert",
      expect.objectContaining({
        factory_id: "f1", name: "Tea", type: "tea",
        unit_id: null, floor_id: null,
        start_time: "10:15", end_time: "10:30", duration_minutes: 15,
      }),
    );
  });

  it("deleteBreakSlot → break_slots delete", () => {
    useApp.getState().deleteBreakSlot("bs1");
    expect(ob.enqueueTable).toHaveBeenCalledWith("break_slots", "delete", {}, { id: "bs1" });
  });

  it("addFactory → factories insert (super admin)", () => {
    useApp.getState().addFactory({ id: "fac-x", name: "New Plant", code: "NP-1", city: "Dhaka", active: true });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "factories",
      "insert",
      { name: "New Plant", code: "NP-1", city: "Dhaka", active: true },
    );
  });

  it("endRunningStyle → line_styles closed update for the active row", () => {
    useApp.setState({
      lineStyles: [{ id: "ls1", lineId: "l1", styleId: "s1", cmPerPcUsd: 2, smv: 10, loadedAt: "x", status: "active" }],
    });
    useApp.getState().endRunningStyle("l1");
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "line_styles",
      "update",
      expect.objectContaining({ status: "closed", unloaded_at: expect.any(String) }),
      { id: "ls1" },
    );
  });

  it("raiseAlert → alerts insert (IE notification to supervisor)", () => {
    useApp.getState().raiseAlert({
      id: "11111111-1111-4111-8111-111111111111",
      lineId: "l1", category: "production", entryRef: "prod-abc",
      note: "Low output", raisedBy: "IE", raisedAt: "2026-07-29T10:00:00Z", status: "open",
    });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "alerts",
      "insert",
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        factory_id: "f1", line_id: "l1", category: "production",
        entry_ref: "prod-abc", status: "open",
      }),
    );
  });

  it("resolveAlert → alerts update (supervisor resolution)", () => {
    useApp.setState({
      alerts: [{ id: "al1", lineId: "l1", category: "production", note: "x", raisedBy: "IE", raisedAt: "t", status: "open" }],
    });
    useApp.getState().resolveAlert("al1", "Fixed it");
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "alerts",
      "update",
      expect.objectContaining({ status: "resolved", resolution_note: "Fixed it", resolved_at: expect.any(String) }),
      { id: "al1" },
    );
  });

  it("updateLineStyleParams → line_styles smv + line_style_costs cm updates", () => {
    useApp.setState({
      lineStyles: [{ id: "ls1", lineId: "l1", styleId: "s1", cmPerPcUsd: 2, smv: 10, loadedAt: "x", status: "active" }],
    });
    useApp.getState().updateLineStyleParams("ls1", { smv: 12, cmPerPcUsd: 3 });
    expect(ob.enqueueTable).toHaveBeenCalledWith("line_styles", "update", { smv: 12 }, { id: "ls1" });
    expect(ob.enqueueTable).toHaveBeenCalledWith(
      "line_style_costs",
      "update",
      expect.objectContaining({ cm_per_pc_usd: 3 }),
      { line_style_id: "ls1" },
    );
  });
});

describe("appStore production writes route through the outbox (RPCs)", () => {
  it("saveAttendance → SAVE_ATTENDANCE", () => {
    useApp.getState().saveAttendance({ lineId: "l1", date: "2026-07-29", operators: 20, helpers: 5, pressmen: 2, checkers: 2 });
    expect(ob.enqueue).toHaveBeenCalledWith("SAVE_ATTENDANCE", expect.objectContaining({ lineId: "l1", date: "2026-07-29" }));
  });

  it("addProductionHour → ADD_HOURLY_PRODUCTION", () => {
    useApp.getState().addProductionHour({
      id: "p1", lineId: "l1", styleId: "s1", date: "2026-07-29", hourSlot: "08:00-09:00",
      goodQty: 100, defectivePcs: 2, totalDefects: 3, enteredAt: "x",
    });
    expect(ob.enqueue).toHaveBeenCalledWith("ADD_HOURLY_PRODUCTION", expect.objectContaining({ lineId: "l1", goodQty: 100 }));
  });

  it("addDowntime → ADD_DOWNTIME", () => {
    useApp.getState().addDowntime({
      id: "d1", lineId: "l1", date: "2026-07-29", startTime: "10:15", endTime: "10:30",
      reasonId: "dr1", note: "", enteredBy: "u", enteredAt: "x",
    });
    expect(ob.enqueue).toHaveBeenCalledWith("ADD_DOWNTIME", expect.objectContaining({ lineId: "l1", reasonId: "dr1" }));
  });

  it("loadStyle → LOAD_STYLE", () => {
    useApp.setState({ styles: [{ id: "s1", code: "TS-1", name: "Tee", valuePerPcUsd: 3 }] });
    useApp.getState().loadStyle({ id: "ls-x", lineId: "l1", styleId: "s1", cmPerPcUsd: 1.5, smv: 10, loadedAt: "x" });
    expect(ob.enqueue).toHaveBeenCalledWith("LOAD_STYLE", expect.objectContaining({ lineId: "l1", styleId: "s1" }));
  });
});

describe("appStore reconnect ordering", () => {
  it("setOnline(true) flushes the outbox BEFORE re-hydrating (no stale clobber)", async () => {
    const order: string[] = [];
    ob.flush.mockImplementation(async () => { order.push("flush"); });
    useApp.setState({ hydrateFromSupabase: vi.fn(async () => { order.push("hydrate"); }) });
    useApp.getState().setOnline(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["flush", "hydrate"]);
  });
});
