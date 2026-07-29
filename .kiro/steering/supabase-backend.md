---
inclusion: manual
---

# Supabase Backend & Offline — Steering

Authoritative guide for building Phase 2 (Supabase) and the offline layer. Pull this in with `#` when working on the repository seam, schema, RLS, aggregation RPCs, offline sync, or KPI backend logic. Full detail (phases, risk register R1–R38, checklist) lives in the referenced plan below.

## Non-negotiable invariants (always follow)

1. **Aggregate in the DB, fetch narrow.** Screens never pull raw rows to compute a dashboard number. `get_kpis` reads the `line_day_agg` summary (even for today) and returns additive aggregates; the client runs `deriveKpis`/`sumAggregates`/`statusFor` from `src/lib/kpi.ts` unchanged.
2. **Repository seam.** Screens talk to a `Repository` interface, never to Supabase or `appStore.dataset()` directly. Swap backends behind the seam.
3. **One call per dashboard.** No per-line/per-date loops (R1). Pass `line_id = ANY(...)` + date range in a single RPC. Cap ranges server-side (≤ 92 days).
4. **Summary maintained by trigger, not cron.** A trigger on `production_hourly` upserts the affected `line_day_agg` row on every write (incl. late offline writes); `pg_cron` is reconciliation-only. Raw rows are touched only by the hourly detail/chart.
5. **RLS is the security boundary.** Deny-by-default; supervisor→assigned lines, chief→owned, IE→all. Client checks are not security.
6. **CM never reaches supervisors.** No `cm_per_pc` via table, view, RPC, or realtime. Supervisors get `smv` only + `cm_value_usd` (summed) for profit.
7. **Offline = immutable event log.** Store intent (events) with a UUID idempotency key, replay optimistically over the cached snapshot, flush sequentially, and gate every write server-side via the `processed_events` ledger. The event log is precious and survives re-auth; the read cache is disposable.
8. **Money is `numeric`, stored in USD, rounded only at display.** FX falls back to last cached rate.
9. **Rollups: sum additive fields first, derive ratios last.** Never average percentages. Guard every divide-by-zero.
10. **KPI correctness:** changeover excludes off-shift + break time; absenteeism floored at `MAX(0, planned - present)`; document the hours-worked-as-slot-count limitation.

## Build order

Phase 0 (repository seam on mock) → 1 (schema/constraints/indexes) → 2 (auth/RLS/CM) → 3 (aggregation) → 4 (wire repo) → 5 (offline) → 7 (FX) → 6 (realtime) → 8 (observability/testing) → 9 (checklist).

## Phase 0 status — DONE (mock-backed)

- `src/data/repository.ts` — async `Repository` interface (Supabase-parity contract). Includes `getKpisByGroup` (batch) to kill the per-child N+1 in drill charts.
- `src/data/mockRepository.ts` — `MockRepository` reads a live store snapshot + reuses `kpi.ts`. `export const repository` is the single swap point → replace with `supabaseRepository` in Phase 4.
- `src/data/queryClient.ts` — React Query client + `bridgeStoreToQueryCache()` invalidates on any mock-data slice change (replaced by Supabase realtime later; query keys stay).
- `src/hooks/useRepo.ts` — hooks: `useKpis`, `useKpisByGroup`, `useProducedSeries`, `useStructure`, `useHourly`, `useActiveLineStyle`, `useDowntime`, `useDowntimeReasons`.
- `kpi.ts` unchanged except added `emptyKpis()` placeholder. The engine is now called **only** from the repository — no screen calls it directly.
- Migrated consumers: `KpiGrid` (covers all 3 dashboards' cards) → `useKpis`/`useProducedSeries`; `IeHome` + `PerformanceExplorer` charts → `useKpisByGroup`.
- **Remaining direct store reads (acceptable, not KPI math):** structure/name lookups (`names.ts`, `ds.styles`), settings/thresholds/currency, and operational counts in `IeHome.perLine`. Move to `getStructure`/settings hooks during Phase 4 if desired.
- Query keys in use: `['kpis',q]`, `['kpisByGroup',groups,base]`, `['producedSeries',lineIds,date]`, `['structure']`, `['hourly',lineId,date]`, `['activeLineStyle',lineId]`, `['downtime',lineId,date]`, `['downtimeReasons',factoryId]`.

## Phase 1 status — schema DONE (RLS pending Phase 2)

- Supabase project ref: `grfjeiodszrgklnillwy` (linked; `supabase/.temp/project-ref`).
- 3 migrations applied + synced to `supabase/migrations/`:
  - `..._phase1_core_enums_factory_users_structure` — 9 enums, `set_updated_at()`, `factories`, `users` (auth link in P2), `units/floors/lines`, `line_supervisors`, `line_chiefs`.
  - `..._phase1_master_and_config` — `styles`, `salary_bank` (effective-dated), `planned_headcount`, `line_styles` (partial-unique one active/line), `app_settings`, `shift_config`, `break_slots`, `kpi_thresholds`, `fx_rates`, `downtime_reasons`.
  - `..._phase1_entry_alerts_downtime_and_triggers` — `attendance`, `production_hourly`, `downtime_events`, `alerts`, `processed_events` + `updated_at` triggers + CM/SMV **freeze trigger** (`prevent_locked_line_style_edit`).
- Locked-decision enforcement in schema: `factory_id` on all tables; one-active-style partial unique; `UNIQUE(line_id,date,hour_slot)` + `UNIQUE(line_id,date)`; `production_hourly.style_id NOT NULL` (block no-style entry); denormalized `floor_id/unit_id` on production for rollups; `ON DELETE RESTRICT` + `archived_at` soft-delete on structure/master; numeric money; effective-dated salary; CM/SMV freeze after first production.
- Types generated → `src/types/database.ts` (do not hand-edit; regenerate via `supabase gen types typescript --linked`).
- **OUTSTANDING (Phase 2):** RLS is DISABLED on all 22 tables (advisor `rls_disabled`, critical). Deny-by-default RLS + per-role policies + CM hiding + auth.users FK on `users.auth_user_id` come in Phase 2. Do NOT expose the anon key to a client against this DB until RLS is on.
- §1.6 seed — DONE: `supabase/seed.sql` (parity mirror of `mock.ts`, one factory, applied) + `supabase/seed_synthetic.sql` (90-day history: 4,890 production rows / 546 attendance / 546 planned). Extra migration `..._phase1_fk_covering_indexes` adds `line_styles(style_id)` + `downtime_events(reason_id)`.
- Index validation — DONE: `EXPLAIN ANALYZE` of a single-line 8-day KPI query uses **Bitmap Index Scan on `ix_production_line_date`** (~1 ms, no seq scan). Other composite indexes flagged "unused" only because they haven't been hit yet on the fresh DB (expected). Audit-user FKs (`entered_by`/`submitted_by`/`raised_by`/etc.) intentionally left unindexed (never filtered).
- **NOTE:** `seed_synthetic.sql` is NOT auto-run by `supabase db reset` unless included; it's a manual perf-testing helper. `seed.sql` is the standard reset seed.

## Phase 2 status — Auth + RLS + CM hiding DONE

- Migrations `phase2a..2e` applied + synced; types regenerated.
- **Auth link:** `users.auth_user_id` → `auth.users(id)` (on delete set null). Real login creation is Phase 4 (super admin via service-role Admin API).
- **RLS helpers** (SECURITY DEFINER, `search_path=''`, EXECUTE granted to `authenticated` only, revoked from PUBLIC/anon): `current_user_id/current_factory_id/current_user_role/is_super_admin/same_factory/can_manage_factory/can_access_line/can_enter_line/can_load_line`.
- **RLS model:** deny-by-default, `to authenticated`. super_admin = full access (its act-as is a frontend concern). ie = whole own factory. chief = owned lines (`line_chiefs`). supervisor = assigned lines (`line_supervisors`). Reads scoped by `can_access_line`; entry writes by `can_enter_line` (supervisor); style loads by `can_load_line` (chief); config/master/structure writes by `can_manage_factory` (IE). `salary_bank` readable only by ie/chief/super. `fx_rates` readable by all authenticated. `processed_events` = no policies (service-role / sync-RPC only).
- **CM hiding (R17) — table isolation, not a definer view:** `cm_per_pc_usd` moved OUT of `line_styles` into `public.line_style_costs` (RLS: ie/chief/super only). Read everything via `public.line_styles_v` (`security_invoker=true` LEFT JOIN) → supervisors get `cm = null` automatically; base `line_styles` (smv/status) is supervisor-readable. **App must read line styles via `line_styles_v`, and write CM to `line_style_costs`.**
- **Freeze triggers** split: `prevent_smv_edit_after_production` (on line_styles) + `prevent_cm_edit_after_production` (on line_style_costs).
- **Verified live** (simulated JWTs, rolled back): supervisor → 1 line, cm null, salary/cost denied; chief → 4 lines, cm visible; ie → 6 lines, cm visible. Advisor: ERROR/search_path cleared; remaining are acceptable `authenticated`-execute WARNs on RLS helpers (only expose caller's own scoped context) + intentional `processed_events` no-policy INFO.
- **Phase 4 note:** read line styles from `line_styles_v` (not `line_styles`); the supabaseRepository's `getKpis` RPC (Phase 3, SECURITY DEFINER) returns `cm_value_usd` aggregates, never per-pc cm.

## Phase 3 status — aggregation layer DONE

- Migrations `phase3a..3d` applied + synced; types regenerated (`line_day_agg`, `get_line_kpis` in `database.ts`).
- **`line_day_agg`** — summary at `(line_id, date, style_id)` grain: production-derived additive fields (`produced_qty/good_qty/defective_pcs/total_defects/slots/produced_minutes/value_usd/cm_value_usd`) + denormalized `factory/floor/unit`. RLS on, no policies (RPC/service-role only). Backfilled (546 rows == raw groups, exact).
- **Trigger-maintained** for ALL days incl today: `trg_production_hourly_agg` (insert/update/delete → `refresh_line_day_agg`); `trg_styles_value_agg` (IE value/pc edit refreshes that style's rows). `rebuild_line_day_agg()` = nightly reconciliation safety net. smv/cm never go stale (frozen after production). Workforce/cost/planned/downtime are NOT stored — joined at read.
- **`get_line_kpis(p_line_ids uuid[], p_start date, p_end date, p_filter_style uuid default null)`** — the single RPC. SECURITY DEFINER, `#variable_conflict use_column`, filters to `can_access_line`, caps range ≤400 days. Returns **one additive-aggregate row per accessible line** (summed over range) matching `kpi.ts` `Aggregate` fields + `downtime_minutes` + `changeover_count`/`changeover_total_min`. EXECUTE: authenticated only.
- **Client contract (Phase 4):** call `get_line_kpis` once with all needed line_ids → sum rows per group (`sumAggregates`) → `deriveKpis`. This replaces `computeKpisForLines`. `getKpisByGroup` = one call, group rows client-side. No N+1, reads summary (not raw) for all ranges incl today.
- **KPI correctness in SQL:** man_hours = Σ(workforce_day × slots_day); slot uniqueness makes per-style slots sum to day slots. Cost via `labor_cost_per_hour` (salary EFFECTIVE on date). Absenteeism/floor + downtime handled in client `deriveKpis` (downtime is separate lost-time, NOT subtracted). Changeover via `changeover_stats` + `working_minutes_between` (off-shift + break exclusion, R33).
- **Verified live:** IE today → 6 lines, man_hours 1035 (=207×5), planned 216, downtime 25min, consistent efficiency/absenteeism. Works after revoking internal-helper execute from authenticated (they run inside the definer RPC).
- **Advisors:** no ERROR. Remaining WARNs are by-design `authenticated`-execute on `get_line_kpis` + RLS helpers (enforce access / return only caller context); INFO = `line_day_agg`/`processed_events` RLS-no-policy (intended).
- **Deferred to Phase 4 (not RPCs):** `get_hourly` and `get_structure` will be direct RLS-safe `supabase.from()` selects (RLS scopes them); no RPC needed.

## Phase 4 status — repository pointed at Supabase (data layer DONE; auth pending)

- `@supabase/supabase-js` installed. `src/lib/supabase.ts` = typed client (`Database` generic) from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. `.env` (gitignored) holds project `grfjeiodszrgklnillwy` URL + publishable key; `.env.example` committed.
- `src/lib/dates.ts` = `resolveDateRange(preset,start,end)` maps today/yesterday/last7/last30/custom → concrete dates (replaces the mock preset fudge factors).
- `src/data/supabaseRepository.ts` implements the full `Repository`: `getKpis`/`getKpisByGroup` → one `rpc('get_line_kpis')` call → `rowToAggregate` → `sumAggregates` → `deriveKpis` (unchanged). `getProducedSeries/getStructure/getHourly/getDowntime/getDowntimeReasons` = RLS-scoped `from()` selects. `getActiveLineStyle` reads **`line_styles_v`** (CM masked for supervisors).
- `src/data/activeRepository.ts` picks the backend: Supabase only when `supabaseConfigured && VITE_DATA_SOURCE==='supabase'`, else mock. `useRepo.ts` imports `repository` from here. Screens unchanged (seam held). Default `VITE_DATA_SOURCE=mock` so the app always runs.
- Build green with the swap compiled in.
- **PENDING to actually flip to supabase (Phase 4b / auth):** RLS needs an authenticated session. Required next: (1) real email/password login creating a Supabase session; (2) create + link auth accounts for users (`users.auth_user_id`); (3) store bootstrap that hydrates `user` (role/factory + lineIds from `line_supervisors`/`line_chiefs`, or all factory lines for IE) from the session. `get_line_kpis` already verified correct under simulated JWTs in Phase 3.
- Supervisor over-derivation nuance (accept/flag with owner): `get_line_kpis` returns `cm_value_usd` + `operating_cost_usd` to supervisors (needed for profit + cost cards, matching the mock UI), so a supervisor could back-compute approximate CM. Per-piece CM itself is never exposed. Revisit if strict hiding is required.

## Phase 4b status — auth wired; live reads working

- **Dev test accounts** (email / `password123`), linked to `public.users.auth_user_id`: `super@rbc.dev`, `ie@rbc.dev`, `chief@rbc.dev`, `sup@rbc.dev`. Created via SQL (bcrypt `extensions.crypt` + `auth.identities`); password hashes verified. NOT in `seed.sql` (env-specific creds).
- `src/lib/auth.ts` — `signIn/signOut` + `loadProfile()` (builds `User` from session: profile from `public.users`, lineIds from `line_supervisors`/`line_chiefs`, or all factory lines for IE / all for super).
- `appStore`: `SUPABASE_MODE` (exported) = configured && `VITE_DATA_SOURCE==='supabase'`. Added `authReady`, `signIn`, `bootstrapAuth` (subscribes `onAuthStateChange` → hydrates/clears `user`). `logout` also `signOut`s in supabase mode. Mock `login(role)` path untouched.
- `App.tsx` calls `bootstrapAuth()` in supabase mode and gates on `authReady`. `Login.tsx` shows email/password in supabase mode, role-picker in mock mode.
- `.env.local` set to `VITE_DATA_SOURCE=supabase` (gitignored). Dev server verified booting.
- **Auth accounts note:** GoTrue (Go) requires ALL `auth.users` string columns to be `''` not NULL. When creating users via raw SQL, set `confirmation_token/recovery_token/email_change_token_new/email_change_token_current/reauthentication_token/email_change = ''` (leave `phone` NULL — unique constraint). Missing this → login 500 `Scan error ... converting NULL to string`.

## Phase 5 status — offline write path (WAL) DONE server-side; wired; hydration pending

- Migration `phase5_sync_rpcs`: idempotent `SECURITY DEFINER` RPCs `sync_attendance`, `sync_production`, `sync_downtime`, `sync_load_style`. Each: `processed_events` guard (idempotent) → `can_enter_line`/`can_load_line` check → upsert on unique key → record event. EXECUTE = authenticated only. **Verified:** double-call with same event id → one row, first value kept, `processed_events`=1, `line_day_agg` trigger updated.
- Client: `dexie` installed. `src/offline/outbox.ts` = event log (`enqueue`, sequential `flush` with retry/backoff → dead-letter after 5, `startOutboxSync` on reconnect + 30s interval, invalidates React Query on success). `main.tsx` starts it in supabase mode.
- **UNIFIED OUTBOX (all writes go through the queue) — DONE:** `outbox.ts` now supports two event kinds: `rpc` (the 4 idempotent sync RPCs) and `table` (direct insert/update/delete for config & master data) via `enqueueTable(table, op, values, match?)`. **Every mutation in `appStore.ts` routes through the outbox** — no more fire-and-forget `void supabase.from().update()` (that trap: the PostgREST builder is lazy, so without `.then()`/`await` the request never fires — this was the silent threshold/currency bug). Config writes covered: kpi_thresholds, app_settings (currency), salary_bank, units/floors/lines (+archive deletes), downtime_reasons (add/toggle), break_slots (add/delete), factories, line_styles lifecycle (end/start/params) + line_style_costs (CM). On successful config flush, `onConfigSynced` → `hydrateFromSupabase()` reconciles server UUIDs. `setOnline(true)` **flushes BEFORE hydrating** so offline edits aren't clobbered by stale server truth. `hydrateFromSupabase` now also loads `break_slots`. **Tests:** `src/offline/outbox.test.ts` (queue engine: dispatch/retry/dead-letter/order/offline-guard/callbacks) + `src/store/appStore.test.ts` (every action → correct outbox call). Run `npm test` (Vitest + fake-indexeddb).
- Store: `saveAttendance/addProductionHour/addDowntime/loadStyle` also `enqueue(...)` in `SUPABASE_MODE` (optimistic local update retained). Mock mode unchanged.
- **KNOWN GAP → Phase 5b (store hydration / mock decoupling):** entry screens + `names.ts` still read structure/styles/reasons from the in-memory `mock` arrays (not hydrated from Supabase). So in supabase mode: attendance can sync (uses real `user.lineIds`), but **production/downtime/load-style enqueue mock string ids** (`s1`, etc.) that fail the RPC uuid casts and dead-letter. To make supabase-mode ENTRY fully work: (1) point `names.ts` + screen structure/style/reason reads at the (hydrated) store or repo, (2) hydrate the store from Supabase on login (structure, active line_styles via `line_styles_v`, downtime_reasons, today's attendance/production/downtime). Mock mode stays fully functional throughout.

## Phase 5b status — store hydration + mock decoupling DONE

- **`hydrateFromSupabase()`** added to appStore. On login (signIn + bootstrapAuth), fetches from Supabase: factories, units, floors, lines, styles, downtime_reasons, fx_rates → populates the store with real UUIDs and data. All screens now read structure/styles/fx/reasons from the store (not directly from mock).
- **`names.ts`** — reads from `useApp.getState()` (store) not from mock. Once hydrated, name lookups use real DB data.
- **`format.ts`** — reads `fxRates` from store (`useApp.getState().fxRates`); no mock import.
- **`src/lib/today.ts`** — extracted `TODAY` const; all 16+ files switched from `@/data/mock` to `@/lib/today`.
- **All screens/components** decoupled: `lines`, `floors`, `units`, `styles`, `FX_RATES`, `lineStyles` now come from the store via `useApp(s => s.x)`. `linesUnder()` helpers in drill screens parameterized.
- **Mock mode unchanged:** store initializes from seed arrays; mock repo still works. Entry screens functional in both modes.
- **Supabase mode entry flow now works end-to-end:** login → hydrate (UUIDs loaded) → entry screens show real lines/styles → enqueue with real UUIDs → sync RPC succeeds → summary trigger updates → KPI dashboard refreshes. The dead-letter problem is eliminated.
- Build green, tsc clean.

## Phase 6 status — Realtime DONE

- `src/realtime/subscribe.ts`: `subscribeToLine(lineId)` — scoped Postgres changes subscription (production_hourly + attendance + downtime_events for ONE line). On event → invalidates relevant React Query keys (kpis, producedSeries, hourly, downtime). One active channel at a time. `unsubscribeAll()` on logout.
- Wired into `SupervisorHome` (useEffect mounts sub for primaryLine, cleans up on unmount). Big rollups (IE/Chief) use refetch-on-focus, not live subs.

## Phase 7 status — FX DONE

- Edge Function `fetch-fx-rates` deployed: fetches `open.er-api.com/v6/latest/USD`, upserts INR+BDT into `fx_rates`. JWT verification off (cron caller). Tested live → got real rates.
- `pg_cron` job `daily-fx-fetch` scheduled at 06:00 UTC (via `pg_net` http_post to the edge function). Migration applied.
- Client reads FX from store (`fxRates`), hydrated from `fx_rates` table on login. Fallback = last cached rate.

## Phase 8 status — Observability + bundle split DONE

- `pg_stat_statements` enabled for slow-query monitoring.
- Code-split routes via `React.lazy` + `Suspense`: 10 route chunks (3–37 KB each), main chunk dropped ~150 KB. Screens load on demand.
- Client error logging deferred (add Sentry/similar if needed). Sync failures visible in IndexedDB outbox (dead-letter state).

## Phase 9 — Pre-launch checklist (VERIFIED against live DB)

- [x] `line_day_agg` maintained by trigger (546 rows, trigger active on production writes) — R5/R9/R37
- [x] RLS enabled on ALL public tables — R16
- [x] `UNIQUE(line_id,date,hour_slot)` on production_hourly — R6/R7
- [x] `UNIQUE(line_id,date)` on attendance — R6
- [x] Partial unique `ux_line_styles_one_active` (one active per line) — R10
- [x] `processed_events` table for offline idempotency — R6/R38
- [x] FX cron job (`daily-fx-fetch`) scheduled — R23
- [x] `pg_stat_statements` for observability — R29
- [x] `get_line_kpis` RPC exists and working — R1/R2/R5/R26
- [x] CM isolated in `line_style_costs` (not on `line_styles`) — R17
- [x] `cm_per_pc_usd` column absent from `line_styles` — R17 (confirmed 0 columns)

### Remaining non-DB items (app-level, for testing):
- [ ] Verify supervisor can enter attendance + production end-to-end (Supabase mode)
- [ ] Verify chief can load style end-to-end
- [ ] Verify IE can add structure + it persists
- [ ] Verify offline entry → sync → KPI refresh (disconnect network, enter, reconnect)
- [ ] Confirm CM hidden for supervisor in live read
- [ ] Test session refresh after long idle (refresh-token expiry)
- [ ] Performance: EXPLAIN on get_line_kpis at 90-day × 50-line scale
- [ ] Bundle budget: verify first-load on throttled 3G is acceptable

## Schema traps (from the app scan — enforce in the DB, not just UI)

1. **Slot uniqueness:** `UNIQUE(line_id,date,hour_slot)` on `production_hourly`. The current app can insert the same slot twice (id uses `Date.now()`), double-counting production while `hoursWorked` (distinct slots) stays flat. Entry path must upsert/update, not insert-new.
2. **Attendance upsert:** `UNIQUE(line_id,date)`; history edits for past days are a first-class flow → summary must recompute for arbitrary past dates.
3. **Production rows are mutable:** IE-flag corrections edit rows in place → summary trigger fires on INSERT **and** UPDATE/DELETE (not append-only).
4. **Planned workforce has two sources** (`line_styles.plannedWorkforce` object|number **and** `planned_headcount`). Pick ONE canonical source (recommend `planned_headcount`) and normalize to a 4-int breakdown; drop the `number` union.
5. **One-time param edit** (`editedOnce` on line-style CM/SMV) must be enforced server-side (`edit_count ≤ 1`), not just in the UI.
6. **Cascade vs. history:** structure deletes must NOT wipe historical entries → `ON DELETE RESTRICT` + soft-delete (`archived_at`).
7. **As-run style:** store `style_id` on `production_hourly` at entry time; never re-derive from the current active style.
8. **Alerts use string `entryRef`** (`prod-{id}`, `att-{lineId}-{date}`) → replace with real FK (`production_hourly_id`) + `(line_id, ref_date)`; alerts are many-to-one per entry.
9. **Breaks are unit/floor-scoped** and affect available minutes; slots are generated per line from shift config. Absenteeism must floor at `MAX(0, planned−present)`.
10. **UUID PKs** (client-generated = offline idempotency keys); keep business codes like `style.code`; `numeric` money in USD, round at display.

## Locked decisions (confirmed with product owner)

1. **Planned workforce** — lives ONLY in IE's `planned_headcount` (per line/day). Remove `plannedWorkforce` from `line_styles` entirely.
2. **Downtime capture** — supervisor taps a **"Downtime" button** on the production screen and records **reason + time range** (e.g. 10:15–10:30). This is **unplanned downtime** → modeled as `downtime_events` (line, date, start, end, reason), many per day.
3. **CM/SMV freeze** — once ANY production is recorded against a style-load, CM and SMV are locked (no edits). Free edits (any number) allowed only before the first production row exists.
4. **Salary effective-dated** — `salary_bank` rows carry `effective_from`; historical KPIs use the rate in effect on that date.
5. **No-active-style production** — production entry is BLOCKED when no style is active on the line (remove the `"s1"` placeholder fallback).
6. **Multi-factory + Super Admin** — top-level `factories` table + `super_admin` role. Super Admin **creates factories AND all logins** for each factory. Each non-super user is tied to **exactly one factory**. **No cross-factory KPI rollup.** Super Admin can **act-as any role of any factory** (impersonation: picks factory + role, app runs in that context). `factory_id` scopes every table; `app_settings`/`shift_config`/`kpi_thresholds`/`salary_bank`/structure are **per factory**. RLS isolates by factory.
7. **Downtime = paid labour, NOT subtracted from any KPI denominator.** Downtime minutes stay in efficiency's available minutes AND in cost/productivity man-hours (workers are paid). Because pieces naturally drop during downtime, efficiency + productivity + cost all worsen automatically — no denominator adjustment needed. Downtime is stored/displayed as a **separate lost-time metric** (total minutes by reason). Efficiency available minutes = shift − **scheduled breaks only** (downtime stays in).
   - **Downtime reasons** = a factory-scoped managed lookup (`downtime_reasons`, IE can add more); `downtime_events` references a reason.
8. **Changeover** — exclude off-shift + scheduled-break time (plan §3.4 / R33).

## Full references

- Phased plan + risk register (R1–R38): #[[file:SUPABASE_IMPLEMENTATION_PLAN.md]]
- Field-level app scan, traps & proposed tables: #[[file:SCHEMA_DESIGN_NOTES.md]]
