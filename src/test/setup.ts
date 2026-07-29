/**
 * Vitest global setup.
 * - Installs a fake IndexedDB so Dexie (the offline outbox) works under Node.
 * - Provides crypto.randomUUID if the runtime lacks it.
 */
import "fake-indexeddb/auto";
import { vi } from "vitest";

if (!globalThis.crypto) {
  // @ts-expect-error minimal shim
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== "function") {
  let n = 0;
  // Deterministic-ish UUIDs for tests
  globalThis.crypto.randomUUID = (() =>
    `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`) as typeof crypto.randomUUID;
}

// navigator.onLine defaults to true in jsdom; expose a helper to flip it.
Object.defineProperty(globalThis.navigator, "onLine", {
  configurable: true,
  get: () => (globalThis as unknown as { __online?: boolean }).__online ?? true,
});

vi.stubGlobal("__setOnline", (v: boolean) => {
  (globalThis as unknown as { __online?: boolean }).__online = v;
});
