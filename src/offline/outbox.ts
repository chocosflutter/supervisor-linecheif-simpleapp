/**
 * Offline write path — Immutable Event Log (WAL) (Phase 5).
 *
 * Writes are appended as events to an IndexedDB (Dexie) outbox, then flushed
 * sequentially to the idempotent Supabase sync RPCs. Each event carries a UUID
 * idempotency key checked server-side against `processed_events`, so retries are
 * safe. On a successful flush batch we invalidate React Query so server-derived
 * KPIs refresh.
 */
import Dexie, { type Table } from "dexie";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/data/queryClient";

export type OutboxAction =
  | "SAVE_ATTENDANCE"
  | "ADD_HOURLY_PRODUCTION"
  | "ADD_DOWNTIME"
  | "LOAD_STYLE";

export interface OutboxEvent {
  id: string; // UUID v4 — the idempotency key (Dexie primary key)
  seq: number; // monotonic ordering
  action: OutboxAction;
  payload: Record<string, unknown>;
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
};

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

function uuid(): string {
  return crypto.randomUUID();
}

/** Append an event and try to flush immediately if online. */
export async function enqueue(action: OutboxAction, payload: Record<string, unknown>): Promise<void> {
  await db.events.add({
    id: uuid(),
    seq: seqCounter++,
    action,
    payload,
    clientTimestamp: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  });
  if (navigator.onLine) void flush();
}

export async function pendingCount(): Promise<number> {
  return db.events.where("status").equals("pending").count();
}

/**
 * Flush pending events in order. Stops at the first still-failing event to
 * preserve causal order (LOAD_STYLE ordering matters). Dead-letters after
 * MAX_RETRIES so a poison event can't block the queue forever.
 */
export async function flush(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  let anySucceeded = false;
  try {
    const pending = await db.events.where("status").equals("pending").sortBy("seq");
    for (const ev of pending) {
      const { error } = await supabase.rpc(RPC_FOR[ev.action] as never, {
        p_event_id: ev.id,
        p_payload: ev.payload,
      } as never);
      if (error) {
        const retryCount = ev.retryCount + 1;
        await db.events.update(ev.id, {
          retryCount,
          lastError: error.message,
          status: retryCount >= MAX_RETRIES ? "failed" : "pending",
        });
        if (retryCount < MAX_RETRIES) break; // retry this one later; keep order
        continue; // dead-lettered; move on
      }
      await db.events.delete(ev.id);
      anySucceeded = true;
    }
  } finally {
    flushing = false;
  }
  if (anySucceeded) void queryClient.invalidateQueries();
}

/** Wire flush triggers: on reconnect + a periodic retry. Call once at startup. */
export function startOutboxSync(): void {
  window.addEventListener("online", () => void flush());
  setInterval(() => void flush(), 30_000);
  void flush();
}
