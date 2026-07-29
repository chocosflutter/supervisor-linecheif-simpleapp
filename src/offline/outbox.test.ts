import { describe, it, expect, beforeEach, vi } from "vitest";
import Dexie from "dexie";

/**
 * Shared, hoisted state so the vi.mock factory (hoisted to top of file) can
 * record every Supabase call and let each test inject failures.
 */
const h = vi.hoisted(() => {
  const calls: Array<Record<string, unknown>> = [];
  const errorRef: { fn: (rec: Record<string, unknown>) => { message: string } | null } = {
    fn: () => null,
  };
  return { calls, errorRef };
});

vi.mock("@/data/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string, op: string, values?: unknown) {
    const rec: Record<string, unknown> = { table, op, values, match: {} as Record<string, unknown> };
    h.calls.push(rec);
    const b: Record<string, unknown> = {
      eq(k: string, v: unknown) {
        (rec.match as Record<string, unknown>)[k] = v;
        return b;
      },
      then(onF: (r: { error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve({ error: h.errorRef.fn(rec) }).then(onF, onR);
      },
    };
    return b;
  }
  const supabase = {
    rpc: vi.fn((name: string, args: unknown) => {
      const rec: Record<string, unknown> = { rpc: name, args };
      h.calls.push(rec);
      return {
        then: (onF: (r: { error: unknown }) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve({ error: h.errorRef.fn(rec) }).then(onF, onR),
      };
    }),
    from: (table: string) => ({
      insert: (values: unknown) => builder(table, "insert", values),
      update: (values: unknown) => builder(table, "update", values),
      delete: () => builder(table, "delete"),
    }),
  };
  return { supabase, supabaseConfigured: true };
});

import { enqueue, enqueueTable, flush, pendingCount, setOnConfigSynced } from "./outbox";
import { queryClient } from "@/data/queryClient";

async function clearOutbox() {
  const db = new Dexie("rbc_outbox");
  db.version(1).stores({ events: "id, seq, status" });
  await db.open();
  await db.table("events").clear();
  db.close();
}

function setOnline(v: boolean) {
  (globalThis as unknown as { __setOnline: (v: boolean) => void }).__setOnline(v);
}

/**
 * Enqueue deterministically: queue while offline (so enqueue's own auto-flush is
 * suppressed), then go online. The test then drives flush() explicitly. This
 * mirrors the real offline→reconnect path and avoids racing the auto-flush.
 */
async function queueRpc(action: Parameters<typeof enqueue>[0], payload: Record<string, unknown>) {
  setOnline(false);
  await enqueue(action, payload);
  setOnline(true);
}
async function queueTable(...args: Parameters<typeof enqueueTable>) {
  setOnline(false);
  await enqueueTable(...args);
  setOnline(true);
}

describe("outbox sync engine", () => {
  beforeEach(async () => {
    await clearOutbox();
    h.calls.length = 0;
    h.errorRef.fn = () => null;
    setOnline(true);
    setOnConfigSynced(() => {});
    vi.clearAllMocks();
  });

  it("flushes an RPC event to the mapped sync RPC with idempotency key", async () => {
    await queueRpc("SAVE_ATTENDANCE", { lineId: "l1", date: "2026-07-29" });
    await flush();
    const rpc = h.calls.find((c) => c.rpc);
    expect(rpc?.rpc).toBe("sync_attendance");
    expect((rpc?.args as { p_payload: unknown }).p_payload).toEqual({ lineId: "l1", date: "2026-07-29" });
    expect((rpc?.args as { p_event_id: string }).p_event_id).toBeTruthy();
    expect(await pendingCount()).toBe(0);
  });

  it("maps each production action to the correct RPC", async () => {
    await queueRpc("ADD_HOURLY_PRODUCTION", {});
    await queueRpc("ADD_DOWNTIME", {});
    await queueRpc("LOAD_STYLE", {});
    await flush();
    const rpcs = h.calls.filter((c) => c.rpc).map((c) => c.rpc);
    expect(rpcs).toEqual(["sync_production", "sync_downtime", "sync_load_style"]);
  });

  it("flushes a table INSERT config event", async () => {
    await queueTable("downtime_reasons", "insert", { factory_id: "f1", label: "Thread break", active: true });
    await flush();
    const c = h.calls.find((x) => x.op === "insert");
    expect(c?.table).toBe("downtime_reasons");
    expect(c?.values).toEqual({ factory_id: "f1", label: "Thread break", active: true });
    expect(await pendingCount()).toBe(0);
  });

  it("flushes a table UPDATE with match filters (.eq)", async () => {
    await queueTable("kpi_thresholds", "update", { watch_min: 600 }, { factory_id: "f1", kpi: "productivity" });
    await flush();
    const c = h.calls.find((x) => x.op === "update");
    expect(c?.table).toBe("kpi_thresholds");
    expect(c?.values).toEqual({ watch_min: 600 });
    expect(c?.match).toEqual({ factory_id: "f1", kpi: "productivity" });
  });

  it("flushes a table DELETE with match filters", async () => {
    await queueTable("break_slots", "delete", {}, { id: "bs1" });
    await flush();
    const c = h.calls.find((x) => x.op === "delete");
    expect(c?.table).toBe("break_slots");
    expect(c?.match).toEqual({ id: "bs1" });
  });

  it("does NOT flush while offline, then flushes everything on reconnect", async () => {
    setOnline(false);
    await enqueueTable("app_settings", "update", { display_currency: "BDT" }, { factory_id: "f1" });
    await flush(); // guarded — offline
    expect(h.calls.length).toBe(0);
    expect(await pendingCount()).toBe(1);

    setOnline(true);
    await flush();
    expect(h.calls.length).toBe(1);
    expect(await pendingCount()).toBe(0);
  });

  it("keeps a failing event pending and increments retry (does not drop it)", async () => {
    h.errorRef.fn = () => ({ message: "boom" });
    await queueTable("salary_bank", "update", { monthly_salary_usd: 100 }, { factory_id: "f1", worker_class: "operator" });
    await flush();
    expect(await pendingCount()).toBe(1); // still queued for retry
  });

  it("dead-letters a poison event after MAX_RETRIES so the queue is not blocked", async () => {
    h.errorRef.fn = () => ({ message: "always fails" });
    await queueTable("units", "insert", { factory_id: "f1", name_en: "U", name_bn: "U" });
    for (let i = 0; i < 5; i++) await flush(); // MAX_RETRIES = 5
    expect(await pendingCount()).toBe(0); // moved to 'failed'
  });

  it("preserves order: a retrying event blocks later events until it succeeds", async () => {
    // First event fails, second should not be attempted this round.
    let failFirst = true;
    h.errorRef.fn = (rec) =>
      failFirst && rec.table === "units" ? { message: "temp" } : null;
    await queueTable("units", "insert", { factory_id: "f1", name_en: "U", name_bn: "U" });
    await queueTable("floors", "insert", { factory_id: "f1", unit_id: "u1", name_en: "F", name_bn: "F" });
    await flush();
    // Only the failing units insert was attempted; floors insert was held back.
    expect(h.calls.filter((c) => c.op === "insert").map((c) => c.table)).toEqual(["units"]);
    expect(await pendingCount()).toBe(2);

    // Now let it succeed — both drain in order.
    failFirst = false;
    await flush();
    expect(h.calls.filter((c) => c.op === "insert").map((c) => c.table)).toEqual(["units", "units", "floors"]);
    expect(await pendingCount()).toBe(0);
  });

  it("invalidates React Query after a successful batch", async () => {
    await queueRpc("SAVE_ATTENDANCE", {});
    await flush();
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it("fires the onConfigSynced callback after a config (table) write succeeds", async () => {
    const cb = vi.fn();
    setOnConfigSynced(cb);
    await queueTable("kpi_thresholds", "update", { watch_min: 600 }, { factory_id: "f1", kpi: "productivity" });
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    setOnConfigSynced(() => {}); // reset
  });

  it("does NOT fire onConfigSynced for a pure production (rpc) batch", async () => {
    const cb = vi.fn();
    setOnConfigSynced(cb);
    await queueRpc("SAVE_ATTENDANCE", {});
    await flush();
    expect(cb).not.toHaveBeenCalled();
    setOnConfigSynced(() => {});
  });
});
