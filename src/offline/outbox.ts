/**
 * Offline write path — Immutable Event Log (WAL) (Phase 5).
 *
 * Every mutation is appended as an event to an IndexedDB (Dexie) outbox, then
 * flushed sequentially to Supabase. Two kinds of events are supported:
 *
 *   - "rpc":   calls an idempotent sync RPC (attendance / production / downtime /
 *              load-style). The event UUID is the idempotency key, checked
 *              server-side against `processed_events`, so retries are safe.
 *   - "table": a direct table write (insert / update) used for config & master
 *              data (KPI thresholds, currency, salary bank, factory structure).
 *              These are naturally idempotent (updates by a stable match, inserts
 *              carry their own client-generated id where relevant).
 *
 * Because writes go through the same durable queue, config edits made OFFLINE are
 * replayed on reconnect exactly like production data — no more silently-dropped
 * fire-and-forget writes. On a successful flush batch we invalidate React Query
 * and (for config writes) re-hydrate the store from server truth.
 */
import Dexie, { type Table } from "dexie";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/data/queryClient";

export type OutboxAction =
  | "SAVE_ATTENDANCE"
  | "ADD_HOURLY_PRODUCTION"
  | "ADD_DOWNTIME"
  | "LOAD_STYLE"
  | "DELETE_UNIT"
  | "DELETE_FLOOR"
  | "DELETE_LINE";

type TableName =
  | "kpi_thresholds"
  | "app_settings"
  | "salary_bank"
  | "units"
  | "floors"
  | "lines"
  | "downtime_reasons"
  | "break_slots"
  | "factories"
  | "line_styles"
  | "line_style_costs"
  | "alerts"
  | "shift_config";
type TableOp = "insert" | "update" | "delete";

export interface OutboxEvent {
  id: string; // UUID v4 — the idempotency key (Dexie primary key)
  seq: number; // monotonic ordering
  kind?: "rpc" | "table"; // defaults to "rpc" for backward compat
  // rpc events
  action?: OutboxAction;
  payload?: Record<string, unknown>;
  // table events
  table?: TableName;
  op?: TableOp;
  values?: Record<string, unknown>;
  match?: Record<string, unknown>; // for update
  isConfig?: boolean; // true → re-hydrate store after flush
  clientTimestamp: string;
  status: "pending" | "failed";
  retryCount: number;
  lastError?: string;
}

const RPC_FOR: Record<OutboxAction, string> = {
  SAVE_ATTENDANCE: "sync_attendance",
  ADD_HOURLY_PRODUCTION: "sync_production",
  ADD_DOWNTIME: "sync_downtime",
  LOAD_STYLE: "sync_load_style",
  DELETE_UNIT: "archive_or_delete_unit",
  DELETE_FLOOR: "archive_or_delete_floor",
  DELETE_LINE: "archive_or_delete_line",
};

/** RPC actions that mutate config/master data → re-hydrate the store after flush. */
const CONFIG_RPC_ACTIONS = new Set<OutboxAction>(["DELETE_UNIT", "DELETE_FLOOR", "DELETE_LINE"]);

const MAX_RETRIES = 5;

class OutboxDB extends Dexie {
  events!: Table<OutboxEvent, string>;
  constructor() {
    super("rbc_outbox");
    this.version(1).stores({ events: "id, seq, status" });
  }
}

const db = new OutboxDB();
let seqCounter = Date.now();
let flushing = false;
/** Resolves when the current in-flight flush completes (if any). */
let flushPromise: Promise<void> | null = null;

/** Optional callback fired after a batch that included config writes succeeds. */
let onConfigSynced: (() => void) | null = null;
export function setOnConfigSynced(cb: () => void): void {
  onConfigSynced = cb;
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Append an RPC event and try to flush immediately if online. */
export async function enqueue(action: OutboxAction, payload: Record<string, unknown>): Promise<void> {
  await db.events.add({
    id: uuid(),
    seq: seqCounter++,
    kind: "rpc",
    action,
    payload,
    clientTimestamp: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  });
  if (navigator.onLine) void flush();
}

/** Append a direct table write (config / master data) and flush if online. */
export async function enqueueTable(
  table: TableName,
  op: TableOp,
  values: Record<string, unknown>,
  match?: Record<string, unknown>,
): Promise<void> {
  await db.events.add({
    id: uuid(),
    seq: seqCounter++,
    kind: "table",
    table,
    op,
    values,
    match,
    isConfig: true,
    clientTimestamp: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  });
  if (navigator.onLine) void flush();
}

export async function pendingCount(): Promise<number> {
  return db.events.where("status").equals("pending").count();
}

async function runEvent(ev: OutboxEvent): Promise<{ error: { message: string } | null }> {
  if (ev.kind === "table") {
    const q = supabase.from(ev.table as never);
    if (ev.op === "insert") {
      const { error } = await q.insert(ev.values as never);
      return { error };
    }
    if (ev.op === "delete") {
      let builder = q.delete();
      for (const [k, v] of Object.entries(ev.match ?? {})) {
        builder = builder.eq(k, v as never);
      }
      const { error } = await builder;
      return { error };
    }
    // update
    let builder = q.update(ev.values as never);
    for (const [k, v] of Object.entries(ev.match ?? {})) {
      builder = builder.eq(k, v as never);
    }
    const { error } = await builder;
    return { error };
  }
  // rpc
  const { error } = await supabase.rpc(RPC_FOR[ev.action as OutboxAction] as never, {
    p_event_id: ev.id,
    p_payload: ev.payload,
  } as never);
  return { error };
}

/**
 * Flush pending events in order. Stops at the first still-retrying event to
 * preserve causal order. Dead-letters after MAX_RETRIES so a poison event can't
 * block the queue forever.
 */
export async function flush(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  let anySucceeded = false;
  let anyConfigSucceeded = false;
  const run = async () => {
    try {
      const pending = await db.events.where("status").equals("pending").sortBy("seq");
      for (const ev of pending) {
        const { error } = await runEvent(ev);
        if (error) {
          const retryCount = ev.retryCount + 1;
          await db.events.update(ev.id, {
            retryCount,
            lastError: error.message,
            status: retryCount >= MAX_RETRIES ? "failed" : "pending",
          });
          if (retryCount < MAX_RETRIES) break; // retry this one later; keep order
          console.error(`[outbox] dead-lettered event ${ev.id} (${ev.kind}/${ev.action ?? ev.table}):`, error.message);
          continue; // dead-lettered; move on
        }
        await db.events.delete(ev.id);
        anySucceeded = true;
        if (ev.isConfig || (ev.action && CONFIG_RPC_ACTIONS.has(ev.action))) anyConfigSucceeded = true;
      }
    } finally {
      flushing = false;
      flushPromise = null;
    }
    if (anySucceeded) void queryClient.invalidateQueries();
    if (anyConfigSucceeded && onConfigSynced) onConfigSynced();
  };
  flushPromise = run();
  return flushPromise;
}

/**
 * Wait until any in-progress flush finishes. If no flush is running, resolves
 * immediately. Use this when you need to ensure all queued writes have been
 * sent to the server before reading server state (e.g. hydration on reconnect).
 */
export async function waitForFlush(): Promise<void> {
  if (flushPromise) await flushPromise;
}

/** Wire flush triggers: on reconnect + a periodic retry. Call once at startup. */
export function startOutboxSync(): void {
  window.addEventListener("online", () => void flush());
  setInterval(() => void flush(), 30_000);
  void flush();
}
