# Supabase Implementation Plan (Phase 2) — Detailed & Phased

> Companion to `IMPLEMENTATION_PLAN.md` and `DESIGN.md`. This document expands the single "Phase 2 — Supabase Integration" stub into a detailed, phase-wise, point-by-point plan. Every step names the **risk it mitigates**.
>
> **Guiding principle:** *Aggregate in the database, fetch narrow.* The client never pulls raw rows to compute a dashboard number — the database returns already-summed additive aggregates, and the existing pure functzions in `src/lib/kpi.ts` (`deriveKpis`, `sumAggregates`, `statusFor`) derive the final KPIs unchanged.
>
> **Golden rule for the whole migration:** screens talk to a **repository interface**, never to Supabase or the store's `dataset()` directly. Swap the backend behind the seam without touching screens.

---

## Risk Register (referenced by ID throughout)

| ID | Risk | Severity |
|----|------|----------|
| R1 | N+1 queries (loop of per-line/per-date calls) | High |
| R2 | Over-fetching whole tables to the client | High |
| R3 | Missing/wrong indexes → seq scans | High |
| R4 | Unbounded date ranges | Med |
| R5 | Re-scanning raw rows for historical dashboards | High |
| R6 | Duplicate rows on offline retry | **High** |
| R7 | Concurrent edits / lost updates (multi-supervisor line) | Med |
| R8 | Referential drift on delete of line/style with history | Med |
| R9 | Stale summary table after late offline write | Med |
| R10 | Retroactive CM/SMV edits corrupt past KPIs | Med |
| R11 | Optimistic UI diverging from server truth | Med |
| R12 | Outbox never drains / poison message | High |
| R13 | IndexedDB eviction / quota loss | Med |
| R14 | Local DB schema migration breaks cached shapes | Med |
| R15 | Clock skew mislabels business day / hour slot | Med |
| R16 | RLS gaps leak cross-line data | **High** |
| R17 | CM value leaks to supervisors | **High** |
| R18 | SECURITY DEFINER RPC bypasses RLS | High |
| R19 | JWT expiry mid-offline loses queued writes | Med |
| R20 | Realtime fan-out overloads low-end devices | Med |
| R21 | Realtime + offline double-apply to cache | Low |
| R22 | KPI recompute on every render | Med |
| R23 | FX fetch fails / offline → money shows 0 | Med |
| R24 | Float money rounding bugs | Med |
| R25 | Timezone "today" ambiguity | Med |
| R26 | Averaging averages → wrong rollups | High |
| R27 | Divide-by-zero / empty periods → NaN | Med |
| R28 | Changeover placeholder (fake 18 min) | Med |
| R29 | No observability into slow queries/errors | Med |
| R30 | Ad-hoc schema drift (no migrations) | Med |
| R31 | Connection exhaustion | Med |
| R32 | Rewriting every screen twice during migration | Med |
| R33 | Overnight/off-shift changeover inflates changeover time | Med |
| R34 | Negative absenteeism when present > planned (over-staffing) | Med |
| R35 | Hours-worked = slot count can't represent partial hours / breakdowns / OT | Med |
| R36 | Refresh-token expiry over a long offline stint forces re-auth | Med |
| R37 | Factory-wide live KPIs computed from raw rows across many lines | **High** |
| R38 | Idempotency for actions without a natural unique key (e.g. LOAD_STYLE) | **High** |

---

## Phase 0 — Repository Seam (still on mock data)

**Goal:** decouple screens from the data source before any backend work, so Supabase becomes a drop-in.

1. Define a `Repository` TypeScript interface: `getKpis(lineIds, range, filterStyleId?)`, `getHourly(lineId, date)`, `getStructure()`, `getActiveLineStyle(lineId)`, `saveAttendance(...)`, `addProductionHour(...)`, `loadStyle(...)`, `getSettings()`, etc.
2. Implement `MockRepository` backed by the current `mock.ts` + `kpi.ts` logic.
3. Refactor screens (`PerformanceExplorer`, `IeHome`, supervisor/chief homes) to consume the repository via React Query hooks instead of `useApp().dataset()` + `computeKpisForLines`.
4. Keep `src/store/appStore.ts` for **UI state only** (user, lang, online, lite, settings); data reads move to the repository.
5. Add React Query provider with structured query keys: `['kpis', level, id, rangePreset]`, `['hourly', lineId, date]`, `['structure']`.

**Mitigates:** R32 (screens never rewritten again), R22 (memoized query results), and sets up the seam that later enables R1/R2/R5 fixes without screen changes.

---

## Phase 1 — Supabase Project, Schema, Constraints & Indexes

**Goal:** a correct, constrained, indexed schema seeded to match current mock data.

### 1.1 Project & tooling
1. Create Supabase project; store keys in `.env` (anon key client-side only; service-role key never bundled).
2. Adopt **migration files in version control** (Supabase CLI) — no hand-editing prod schema.
3. Use the **pooled connection** (PgBouncer/pooler) for any server-side/function access.

**Mitigates:** R30 (schema drift), R31 (connection exhaustion).

### 1.2 Core tables (from `IMPLEMENTATION_PLAN.md` §5 / `src/types`)
1. Structure: `units`, `floors`, `lines` — keep `name_en` + `name_bn`.
2. Denormalize `unit_id` + `floor_id` onto `lines` (already implied) and store `line_id` + `floor_id` + `unit_id` on `production_hourly` so rollups avoid multi-level joins.
3. Master: `styles`, `salary_bank`, `planned_headcount`, `line_styles`.
4. Entry: `attendance`, `production_hourly`.
5. Config: `app_settings`, `shift_config`, `kpi_thresholds`, `fx_rates`, `alerts`.
6. Assignment: `line_supervisors`, `line_chiefs` (many-to-many).
7. Sync: `processed_events(event_id uuid primary key, action, processed_at)` — server-side idempotency ledger for the offline event log (Phase 5.2).

**Mitigates:** R1/R5 (denormalized hierarchy enables single-query rollups).

### 1.3 Money & types
1. All monetary columns `numeric` (not `float`/`double`). Store canonical **USD**.
2. Dates as `date` (business date); timestamps as `timestamptz`.

**Mitigates:** R24 (float money bugs).

### 1.4 Constraints (integrity)
1. **Unique** `attendance(line_id, date)`.
2. **Unique** `production_hourly(line_id, date, hour_slot)`.
3. Foreign keys with `ON DELETE RESTRICT` for anything holding history; **soft-delete** (`archived_at`) for structure (units/floors/lines/styles).
4. `line_styles`: parameter **versioning via `effective_from`** OR freeze CM/SMV once production is recorded against the load.
5. Check constraints: non-negative counts/quantities.

**Mitigates:** R6 (unique → upsert not duplicate), R7 (concurrent edit collision caught), R8 (referential drift), R10 (retroactive param edits).

### 1.5 Indexes
1. Composite: `production_hourly(line_id, date)`, `attendance(line_id, date)`, `line_styles(line_id, status)`, `planned_headcount(line_id, date)`.
2. Index FKs used in rollups (`floor_id`, `unit_id` on `production_hourly` if denormalized).
3. Validate with `EXPLAIN ANALYZE` against **realistic** row counts (seed a year of data), not 6 mock lines.

**Mitigates:** R3 (seq scans).

### 1.6 Seed
1. Seed script mirroring `mock.ts` for dev/staging parity + a large synthetic dataset for index/load testing.

**Mitigates:** R3/R5 validation, debugging parity.

---

## Phase 2 — Auth, RLS & CM Hiding

**Goal:** security boundary enforced entirely in the database.

1. Enable Supabase Auth (email/phone); map `auth.uid()` → `users` row + role.
2. **Deny-by-default RLS** on every table. Policies join to `line_supervisors` / `line_chiefs` for row visibility:
   - Supervisor → only assigned lines.
   - Chief → only owned lines.
   - IE → all.
3. **CM hiding (R17 — hard requirement):**
   - Revoke column access to `line_styles.cm_per_pc` for supervisor role.
   - Serve supervisors a **view/RPC returning `smv` only** (needed for efficiency), never `cm_per_pc`.
   - Aggregate RPCs return `cm_value_usd` (summed `good_qty × cm_per_pc`) — profit is derivable, per-pc CM never transmitted.
   - Audit realtime payloads so CM never rides along in a change event.
4. **RPC safety:** prefer `SECURITY INVOKER`; where `SECURITY DEFINER` is required, filter inside the function by the caller's allowed lines (`auth.uid()`), never trust client-passed line IDs blindly.
5. Write **RLS tests**: each role × each table, assert allowed + denied paths.

**Mitigates:** R16 (RLS gaps), R17 (CM leak), R18 (definer bypass).

---

## Phase 3 — Aggregation Layer (the anti-N+1 / anti-heavy-load core)

**Goal:** dashboards are one query, regardless of line/day count; historical reads never scan raw rows.

### 3.1 Summary table — incrementally maintained for ALL days (incl. today)
> **Decision (revised):** Do **not** compute "today" live from raw rows. Maintain `line_day_agg` incrementally so `get_kpis` *always* reads the tiny summary — even for the current day. Raw `production_hourly` rows are touched **only** by the hourly detail/chart. This removes the factory-wide "live scan across 50+ lines at 5 PM" bottleneck and makes late-write handling reliable.

1. Create `line_day_agg`: one row per `(line_id, date, style_id)` holding the **production-derived additive Aggregate** fields from `kpi.ts` — `produced_qty`, `good_qty`, `defective_pcs`, `total_defects`, `produced_minutes`, `value_usd`, plus changeover components. The small `attendance` + `salary_bank` rows (one per line/day) are joined **at read** for workforce/cost/man-hours — they are tiny, so no raw scan.
2. **Trigger-based incremental maintenance:** an `AFTER INSERT/UPDATE/DELETE` trigger on `production_hourly` recomputes (upserts) only the affected `(line_id, date, style_id)` summary row. A trigger on `line_styles` param changes / `attendance` invalidates the relevant read as needed.
3. **`pg_cron` reconciliation job** runs only as a nightly **safety net** to detect/repair any drift between summary and raw — not as the primary write path.
4. **Late offline write** for a past date fires the same trigger → that day's summary row is recomputed immediately (no 24h staleness window).
5. Accept minor **write amplification** (one indexed upsert per hourly entry, ~once/hour/line) as the cost of a unified, scan-free read path.

**Mitigates:** R5 (no raw re-scan), R9 (trigger recomputes immediately, no cron lag), R37 (factory-wide reads sum summary rows, never raw).

### 3.2 The single KPI RPC
1. `get_kpis(line_ids uuid[], start_date, end_date, filter_style_id?)`:
   - **All days (incl. today):** `SUM` over `line_day_agg` with `WHERE line_id = ANY(...) AND date BETWEEN ...`, joined to the tiny `attendance` + `salary_bank` rows for workforce/cost. No raw `production_hourly` scan at any range.
   - Returns **additive aggregates** (optionally grouped by line/floor/unit for drill views) — client runs `deriveKpis`/`sumAggregates` unchanged.
2. **Cap the range** server-side (e.g. ≤ 92 days); force summary path for long ranges.
3. Always **sum additive components first, derive ratios last** (both in SQL and client) — never average percentages.
4. Preserve divide-by-zero guards (return 0/null, render "no data").

**Mitigates:** R1 (loop → one call), R2 (aggregates not rows), R4 (range cap), R26 (no averaging averages), R27 (empty periods), R37 (summary read even for today).

### 3.3 Supporting reads
1. `get_hourly(line_id, date)` — raw rows for the hourly-entry screen and hourly trend chart **only**, scoped to one line/day.
2. `get_structure()` — small, cacheable lookup of units/floors/lines/styles names.

**Mitigates:** R2 (raw rows only where truly needed), R1 (name lookups cached, not per-row).

### 3.4 Changeover
1. Implement real changeover from `line_styles.loaded_at/unloaded_at` + first/last good-piece timestamps in `production_hourly`.
2. **Exclude off-shift & break time.** Compute the elapsed gap between the last good piece of the old style and the first good piece of the new style, then **subtract non-shift hours and any `shift_config.breaks`** that fall inside the gap. Prevents a 5 PM→9 AM handover being logged as a 16-hour changeover.
3. Define behavior when timestamps are missing/offline (fallback + flag).

**Mitigates:** R28 (fake changeover), R33 (overnight/off-shift inflation).

### 3.5 KPI correctness fixes (carry into SQL and `kpi.ts`)
1. **Absenteeism floor:** use `MAX(0, planned - present)` for absent man-days so over-staffing (chief pulls extra helpers) never yields a negative %. Surface **over-staffing as its own indicator** so the signal isn't lost by the floor.
2. **Hours-worked granularity (known limitation):** `hoursWorked = distinct slot count` cannot represent partial hours, machine breakdowns, or a 30-min OT push. Mitigation options (pick per appetite for scope): capture **actual run minutes per slot** (or a partial-slot flag), or derive worked minutes from `shift_config` minus `breaks`, instead of counting whole slots. Keep optional to preserve the "simple app" goal, but document the skew it introduces to efficiency/cost until addressed.
3. Preserve existing divide-by-zero guards (`safe()`), returning 0/null → render "no data".

**Mitigates:** R34 (negative absenteeism), R35 (hours granularity), R27 (empty periods).

---

## Phase 4 — Point Repository at Supabase

**Goal:** swap `MockRepository` → `SupabaseRepository` behind the Phase 0 seam.

1. Implement `SupabaseRepository` calling the Phase 3 RPCs + reads.
2. React Query config:
   - Historical ranges: long `staleTime` (they don't change) — cache aggressively.
   - "Today": short `staleTime`, refetch on focus/interval.
   - Shared query keys so multiple components showing the same data dedupe (no refetch storm).
3. **Lazy drill in Performance Explorer:** load only the current level; fetch a unit's floors on tap, never preload the whole tree.
4. Remove the mock date-preset fudge factors (`×0.96` etc.) — real dated rows replace them.

**Mitigates:** R1/R2/R5 (now live), R22 (cached/deduped), and confirms behavior parity.

---

## Phase 5 — Offline Layer (read cache + write outbox + sync)

**Goal:** dashboards render offline; supervisor data entry works offline and syncs safely.

### 5.1 Read cache
1. Persist last successful `get_kpis` results in **IndexedDB** (Dexie) via React Query persister.
2. Show "last synced at HH:MM" when offline (matches top-bar indicator).
3. Treat read cache as **disposable**; version + namespace it so a version bump can safely clear it.

**Mitigates:** R13 (cache is disposable), R14 (versioned local schema).

### 5.2 Write path — Immutable Event Log (WAL), not a row outbox
> **Decision (revised):** Store **intent (events)**, not table rows. Never mutate local row tables directly. Render optimistic UI by replaying pending events over the cached server snapshot. This is cleaner than row-diffing and gives idempotency for actions that have **no natural unique key** (e.g. `LOAD_STYLE`).

1. **Event shape** in IndexedDB (Dexie): `{ id: UUIDv4 (idempotency key), action: 'SAVE_ATTENDANCE' | 'ADD_HOURLY_PRODUCTION' | 'LOAD_STYLE', payload, clientTimestamp, status: 'pending'|'syncing'|'failed', retryCount, lastError? }`.
2. **Optimistic view:** UI state = cached server snapshot **with pending events applied on top**. Local row tables are never edited directly.
3. **Sequential flush on reconnect:** replay events **in order** to dedicated RPCs (`sync_attendance`, `sync_hourly_production`, `sync_load_style`). Ordering matters — `LOAD_STYLE` drives changeover/queue logic.
4. **Server-side idempotency:** each RPC checks the event `id` against a **`processed_events` table** in Postgres. If already present → skip the write, return success. Makes **every** action safe to retry, not just ones with a unique key. Unique constraints (Phase 1.4) remain as a second line of defense.
5. Keep event `pending` until server ack; on ack mark processed and drop from optimistic overlay; surface a **"failed to sync"** state, never silently drop.
6. Retry with **backoff**; after N attempts move to **dead-letter** (`failed`); show "X entries pending" so it's never invisible.
7. **Auth on reconnect:** attempt `refreshSession()` before flushing (internet is back on reconnect, so refresh works). If the **refresh token itself expired** over a long offline stint, prompt re-auth — but the **event log survives re-auth** and flushing resumes for the same user, so no queued write is ever lost.
8. Treat the event log as **precious** (warn before any clear); read cache stays disposable.

**Mitigates:** R6 (server idempotency + upsert), R11 (pending until ack), R12 (backoff + dead-letter + visibility), R13 (log protected), R36 (log survives forced re-auth), R38 (idempotent regardless of unique key).

### 5.3 Sync conflict policy
1. Append-only per `(line, date, hour_slot)`; **last-write-wins** keyed on the slot via upsert; violations flagged for review, not dropped.
2. **Business date + hour slot computed/validated server-side** on sync (guard against device clock skew); store device time but stamp authoritative `server_received_at`.

**Mitigates:** R7 (defined conflict rule), R15 (clock skew), R9 (late writes mark day dirty → re-finalize).

---

## Phase 6 — Realtime (scoped, added last)

**Goal:** live updates without overloading low-end devices or quotas.

1. Subscribe **only to the narrow slice on screen** (supervisor's own line, today) — never broad tables.
2. On a realtime event, **invalidate the relevant React Query key** (refetch small aggregate) rather than streaming rows into every client.
3. Big rollups use **poll/refetch-on-focus**, not live subscriptions.
4. Make cache updates **idempotent** (keyed on PK/idempotency key) so realtime + synced local write don't double-apply.
5. Confirm realtime payloads **never carry `cm_per_pc`**.

**Mitigates:** R20 (fan-out), R21 (double-apply), R17 (CM in payloads).

---

## Phase 7 — FX & Currency

**Goal:** correct money display, resilient to FX outages.

1. Daily fetch `open.er-api.com` → cache in `fx_rates`; **always fall back to last cached rate** when offline/failed; show rate age.
2. Never block dashboards on FX; render with last known rate.
3. Store canonical USD (`numeric`), **round only at display**.
4. Optionally snapshot the rate used for historical figures if drift accuracy matters.

**Mitigates:** R23 (FX failure), R24 (rounding).

---

## Phase 8 — Observability, Testing & Hardening

**Goal:** know when something degrades before users do.

1. Enable `pg_stat_statements` / Supabase logs; watch slow queries after real load.
2. Client error reporting + **log sync failures** (outbox dead-letters).
3. RLS test suite (Phase 2.5), KPI correctness tests (rollup = sum-then-derive), offline sync tests (retry/duplicate/late-write).
4. Bundle budget: code-split routes, lazy-load Recharts, keep Supabase+Dexie lean for low-end Android first load.

**Mitigates:** R29 (observability), R16/R17/R26/R6 (regression tests), client-perf.

---

## Phase 9 — Pre-Launch Checklist

- [ ] No screen selects raw rows for a dashboard number; `get_kpis` reads `line_day_agg` even for today (R2/R5/R37).
- [ ] Every `(line_id, date)` filter path is indexed & `EXPLAIN`-verified on large data (R3).
- [ ] `get_kpis` is a single call for any line/day span; range capped (R1/R4).
- [ ] `line_day_agg` maintained by trigger on write; cron is reconciliation-only (R9/R37).
- [ ] Unique constraints on attendance & hourly; sync upserts (R6/R7).
- [ ] RLS deny-by-default; per-role tests pass (R16).
- [ ] Supervisor cannot retrieve `cm_per_pc` via table, view, RPC, or realtime (R17).
- [ ] Event log: idempotency keys, `processed_events` server check, sequential flush, backoff, dead-letter, visible pending count (R6/R12/R38).
- [ ] Event log survives forced re-auth; refresh attempted on reconnect (R36).
- [ ] Changeover excludes off-shift + break time (R33).
- [ ] Absenteeism floored at `MAX(0, planned-present)`; over-staffing tracked separately (R34).
- [ ] Hours-worked granularity limitation documented / mitigated (R35).
- [ ] FX falls back to cached rate; money is `numeric`, rounded at display (R23/R24).
- [ ] Business date/hour slot resolved server-side (R15/R25).
- [ ] Rollups sum additive fields then derive; no averaging of percentages (R26).
- [ ] Divide-by-zero guarded everywhere (R27).
- [ ] Realtime scoped to on-screen slice; invalidates cache (R20/R21).
- [ ] Migrations in version control; pooled connection used server-side (R30/R31).

---

## Recommended build order

Phase 0 → 1 → 2 → 3 → 4 → 5 → 7 → 6 → 8 → 9.

Rationale: seam first (zero backend risk), then schema/security/aggregation foundation, then wire it up, then offline (highest data-integrity risk gets full attention), FX before realtime (realtime is the least critical), hardening and checklist last. The two highest-severity concerns for this app — **offline duplicate/lost writes (R6)** and **CM leak (R17)** — get dedicated phases (5 and 2).
