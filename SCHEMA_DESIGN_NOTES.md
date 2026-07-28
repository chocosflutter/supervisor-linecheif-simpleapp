# Schema Design Notes — Nitty-Gritties from the App Scan

> Source-of-truth notes gathered by scanning the actual app (`src/types`, `src/store/appStore.ts`, `src/lib/kpi.ts`, `src/data/mock.ts`, and every screen). Read this **before** writing the Supabase schema. It captures the exact fields the UI reads/writes, plus the subtle behaviors and traps that the types alone don't reveal.
>
> Companion to `SUPABASE_IMPLEMENTATION_PLAN.md`. Risk IDs (R#) reference that plan.

---

## Part A — Entities & exact fields as the code uses them

### A1. Users & assignment
- `User`: `id`, `name`, `role` (`supervisor | chief | ie`), `lineIds: string[]`.
- A **supervisor** can own **multiple lines** (`HourlyEntry` shows a line switcher when `lineIds.length > 1`).
- A **chief** owns **multiple lines** (`ChiefHome`, `LoadStyle` filter by `user.lineIds`).
- **IE** sees all lines (audit screens iterate all `lines`).
- `lang_pref`: currently in `localStorage`; plan says persist per user.
- → Needs **join tables**, not an array column: `line_supervisors(line_id,user_id)`, `line_chiefs(line_id,user_id)`.

### A2. Structure (hierarchy)
- `Unit{ id, name_en, name_bn }` → `Floor{ id, unitId, name_en, name_bn }` → `Line{ id, floorId, name_en, name_bn }`.
- Every user-facing name is **bilingual** (`_en` + `_bn`); `names.ts` picks by lang. Bengali optional in UI (falls back to EN).
- Deleting a unit cascades floors + lines; deleting a floor cascades lines (`appStore.deleteUnit/deleteFloor`). See trap #7.

### A3. Styles (IE master)
- `Style{ id, code, name, valuePerPcUsd }`. `code` is a **business code** (e.g. "PL-2201") shown everywhere — keep it as a real column even after switching ids to UUID.
- `valuePerPcUsd` stored USD, entered by IE.

### A4. Salary bank (IE master)
- `SalaryBankEntry{ workerClass, monthlySalaryUsd, workingDays, standardHours }` for the **4 fixed classes** `operator | helper | pressman | checker`.
- `workingDays` & `standardHours` are **only** for the hourly-rate calc: `costPerHour = monthlySalary / (workingDays × standardHours)`.
- Editable per class (`EditSalaryModal`); entered in local currency, converted to USD on save (`numSalary / rate`).

### A5. Line-style loads (chief)
- `LineStyle{ id, lineId, styleId, cmPerPcUsd, smv, plannedWorkforce, loadedAt, unloadedAt?, editedOnce?, status? }`.
- `status`: `active | queued | closed`. **Only one active style per line.** Loading a new style while one is active → new one is `queued`; ending the active one closes it; starting a queued one sets it `active`, resets `loadedAt`, clears `unloadedAt`, and closes the previous active.
- `plannedWorkforce`: **either** a class breakdown `{operators,helpers,pressmen,checkers}` **or** a plain `number`. See trap #1.
- `editedOnce`: chief may correct CM/SMV/workforce **exactly once** (`updateLineStyleParams` sets `editedOnce=true`; UI then locks the edit button). See trap #3.
- `loadedAt`/`unloadedAt` drive **changeover**.

### A6. Attendance (supervisor)
- `Attendance{ lineId, date, operators, helpers, pressmen, checkers }`.
- **Upsert per `(lineId,date)`** — `saveAttendance` removes any existing row for that key and re-adds. Editable for **past days** too (`SupervisorAttendance` history edit). See trap #6/#8.

### A7. Planned headcount (IE, previous day)
- `PlannedHeadcount{ lineId, date, operators, helpers, pressmen, checkers }`. Feeds absenteeism man-days.
- **Overlaps** with `LineStyle.plannedWorkforce` — two sources of "planned". See trap #1.

### A8. Hourly production (supervisor)
- `ProductionHour{ id, lineId, styleId, date, hourSlot, goodQty, defectivePcs, totalDefects, enteredAt }`.
- UI collects **Inspected**, **Defective**, **Defects found**; stores `goodQty = inspected − defective`. So `inspected = goodQty + defectivePcs` (== produced). No separate "produced" field.
- `styleId` is captured from the **currently active** line-style at entry time and **stored on the row** (needed for historical/style-wise accuracy — don't re-derive from current active style). Falls back to `"s1"` when no active style (placeholder bug — see trap #12).
- `hourSlot` format: `"HH:00-HH:00"`. Rows are **mutable** (`updateProductionHour` patches by id for IE-flagged corrections). See traps #4, #5.

### A9. Shift & breaks (IE settings)
- `ShiftConfig{ start, end, breaks: BreakSlot[] }`.
- `BreakSlot{ id, name, type(tea|lunch|prayer|other), unitId, floorId, startTime, endTime, durationMinutes }`.
- Break scope: `unitId`/`floorId` = `"all"` or a specific id. `buildSlots()` in `HourlyEntry` applies a break to a slot only if it matches the line's unit **and** floor.
- Break ≥ 60 min ⇒ slot flagged `isFullBreak` (no production expected); shorter ⇒ partial (reduces available minutes). See trap #9.
- Hour slots for production are **generated from shift start/end per line** (respecting that line's breaks). Slots are not a fixed global list.

### A10. KPI thresholds & settings (IE)
- `KpiThreshold{ kpi, goodMin, watchMin, direction(higher_is_better|lower_is_better) }` for keys `productivity|cost|efficiency|profit|changeover|absenteeism|defective|dhu`.
- `AppSettings{ displayCurrency('INR'|'BDT'), shift, thresholds }`. Currency is a **global IE setting**, not per user.

### A11. Alerts (IE ↔ supervisor)
- `IeAlert{ id, lineId, category(production|defects|attendance|style), entryRef?, note, raisedBy, raisedAt, status(open|resolved), resolvedBy?, resolvedAt?, resolutionNote? }`.
- `entryRef` is a **client-built string**: `prod-{productionId}`, `def-{productionId}`, `att-{lineId}-{date}`. Multiple alerts can target one entry (filtered as a list). Resolution stores a human-readable **diff note** ("defective 4→2 — Remark: …"). See trap #10.

### A12. FX
- `FX_RATES{ INR, BDT }` keyed off USD; currently static mock. Plan: daily fetch + cache + fallback.

---

## Part B — Critical nitty-gritties / traps (the non-obvious ones)

1. **`plannedWorkforce` has two homes and two shapes.** It lives on both `line_styles` (as `object | number`) **and** `planned_headcount`. `kpi.ts` prefers `activeLs.plannedWorkforce`, falling back to `planned_headcount`. **Decision needed:** pick one canonical source for absenteeism, and **normalize to a 4-int breakdown** (kill the `number` union). Recommend: `planned_headcount` is the IE-owned source of truth per `(line,date)`; drop or rename the copy on `line_styles`.

2. **Absenteeism can go negative.** `((planned − present)/planned)×100` with no floor → over-staffing yields negative %. Add `MAX(0, planned−present)`; track over-staffing separately (R34).

3. **One-time edit lock on line-style params.** `editedOnce` gates a single correction of CM/SMV/workforce. The DB must enforce this (not just the UI) — e.g. an `edit_count`/`edited_once` column checked in the update RPC, or an immutable-after-first-edit rule. Editing SMV/CM retroactively changes past efficiency/profit (R10) → consider parameter versioning or freeze-after-production.

4. **Production rows are mutable, not append-only.** IE flags an hour → supervisor `updateProductionHour` edits it in place. The plan's "append-only" conflict assumption is wrong for corrections. Sync must handle **update-by-id**, and the summary trigger must recompute on UPDATE (and DELETE), not just INSERT (R9).

5. **No one-entry-per-slot guarantee today.** `save()` in `HourlyEntry` builds a new id with `Date.now()` every time, so the same `(line,date,hourSlot)` can be inserted **twice** → production double-counts while `hoursWorked` (distinct slot count) stays the same, silently skewing KPIs. **Schema must add `UNIQUE(line_id,date,hour_slot)`** and the entry path must **upsert/update**, not insert-new (R6/R7).

6. **Attendance is an upsert per `(line,date)`.** Enforce `UNIQUE(line_id,date)`; sync should upsert. History edits for past days must re-trigger summary recompute for that date.

7. **Cascade deletes vs. historical integrity.** In-memory delete cascades units→floors→lines. In Postgres this must **not** wipe historical production/attendance. Use `ON DELETE RESTRICT` + **soft-delete** (`archived_at`) for structure so past KPIs stay valid (R8).

8. **Historical edits are a first-class flow**, not an edge case (both attendance and production support past-day correction). Any daily summary/aggregate must be **recomputable** for arbitrary past dates (R9).

9. **Breaks affect available minutes but `kpi.ts` currently ignores them.** Efficiency uses `60 × hoursWorked × workforce` with no break subtraction, and `hoursWorked` = distinct slot count (whole hours only). Real available minutes should subtract break minutes and handle partial/full-break slots. Decide whether to store **actual run minutes per slot** vs. whole-hour slots (R35). Break scope is unit/floor-specific, so available minutes are line-specific.

10. **Alerts use string `entryRef`, not FKs.** In Postgres, replace with proper references: `production_hourly_id` (for production/defects) or `(line_id,date)` (for attendance), plus the `category` enum. Keep alerts **many-to-one** to an entry. Preserve the resolution diff note + `resolved_by/at`.

11. **`styleId` on production must be the style running at entry time** (stored on the row), so style-wise reports and changeover stay correct after the line switches styles. Don't derive from "current active style."

12. **"No active style" is a real state.** Lines can have no active style (`status` closed/queued, line paused). Production entry currently falls back to `"s1"` — a placeholder to remove. Decide: block production when no active style, or allow a null style. Recommend blocking (or requiring an explicit active style) so KPIs stay meaningful.

13. **Money is entered in local currency, stored USD, displayed converted.** Rounding happens at entry (`salary/rate`) → historical drift (R23/R24). Use `numeric`, store USD, round at display; consider snapshotting the entry-time rate.

14. **`hourSlot` is a string derived from shift config.** If IE later changes shift start/end, historical slot strings won't align with the new config. Store the slot string on the row (already done) and validate against the shift config **effective on that date**, not the current one (R15/R25).

15. **Currency & shift & thresholds are singletons** (one `app_settings`/`shift_config`, a set of `kpi_thresholds`). Model as single-row config tables (or a factory-scoped row if multi-factory later). Thresholds ship with defaults, IE overrides.

16. **IDs are human prefixes** (`u1`,`f1`,`l1`,`s1`,`ls1`). Move to UUID PKs; keep business codes (`style.code`) as separate columns. Client-generated UUIDs also serve as offline idempotency keys (R6/R38).

17. **No audit columns today.** Add `created_at/updated_at` (+ `created_by` where useful) to every table; entry tables already carry `enteredAt/loadedAt/raisedAt/resolvedAt` — keep those as domain timestamps distinct from row audit stamps.

18. **`totalDefects` can exceed `defectivePcs`** (DHU counts defects, defective counts pieces). Don't add a check forcing `totalDefects ≤ defectivePcs`. Do enforce `defectivePcs ≤ inspected` (UI clamps it).

---

## Part C — Proposed tables

> UUID PKs everywhere; `numeric` for money (USD); `date` for business day; `timestamptz` for events; `created_at/updated_at` on all. Soft-delete (`archived_at`) on structure/master tables.

### Structure & people
- **users** — `id, auth_uid, name, role, lang_pref, created_at`
- **units** — `id, name_en, name_bn, archived_at`
- **floors** — `id, unit_id→units, name_en, name_bn, archived_at`
- **lines** — `id, floor_id→floors, unit_id→units (denormalized for rollups), name_en, name_bn, archived_at`
- **line_supervisors** — `id, line_id→lines, user_id→users` · `UNIQUE(line_id,user_id)`
- **line_chiefs** — `id, line_id→lines, user_id→users` · `UNIQUE(line_id,user_id)`

### IE master data
- **styles** — `id, code (unique business code), name, value_per_pc_usd numeric, archived_at`
- **salary_bank** — `id, worker_class enum, monthly_salary_usd numeric, working_days int, standard_hours int, effective_from date` · consider effective-dating for historical cost accuracy
- **planned_headcount** — `id, line_id→lines, date, operators, helpers, pressmen, checkers, entered_by→users, created_at` · `UNIQUE(line_id,date)` · **canonical planned source** (trap #1)

### Chief data
- **line_styles** — `id, line_id→lines, style_id→styles, cm_per_pc_usd numeric, smv numeric, status enum(active|queued|closed), loaded_at timestamptz, unloaded_at timestamptz null, edit_count int default 0 (enforce ≤1), created_by→users` · **partial unique index: at most one `active` per line** · index `(line_id,status)`
  - Drop `plannedWorkforce` here in favor of `planned_headcount` (trap #1), or keep only if it must differ per style-load — if kept, normalize to 4 ints and make it the source consistently.

### Supervisor entry
- **attendance** — `id, line_id→lines, date, operators, helpers, pressmen, checkers, submitted_by→users, submitted_at` · `UNIQUE(line_id,date)` · index `(line_id,date)`
- **production_hourly** — `id (client UUID), line_id→lines, floor_id, unit_id (denorm), style_id→styles (as-run), date, hour_slot text, good_qty, defective_pcs, total_defects, entered_by→users, entered_at, updated_at` · `UNIQUE(line_id,date,hour_slot)` (trap #5) · `CHECK(defective_pcs ≤ good_qty + defective_pcs)` · index `(line_id,date)`

### Config (singletons / small sets)
- **app_settings** — `id, display_currency enum(INR|BDT)` (single row)
- **shift_config** — `id, shift_start time, shift_end time` (single row; effective-dating optional)
- **break_slots** — `id, name, type enum(tea|lunch|prayer|other), unit_id null|all-sentinel, floor_id null|all-sentinel, start_time, end_time, duration_minutes`
- **kpi_thresholds** — `id, kpi enum, good_min numeric, watch_min numeric, direction enum` · `UNIQUE(kpi)`
- **fx_rates** — `id, base('USD'), currency enum(INR|BDT), rate numeric, fetched_at` · `UNIQUE(currency, fetched_at::date)`

### Alerts
- **alerts** — `id, line_id→lines, category enum(production|defects|attendance|style), production_hourly_id→production_hourly null, ref_date date null (for attendance), note, raised_by→users, raised_at, status enum(open|resolved), resolved_by→users null, resolved_at null, resolution_note null` · index `(line_id,status)`, `(production_hourly_id)`

### Backend-only (from the Supabase plan)
- **line_day_agg** — trigger-maintained additive summary per `(line_id,date,style_id)` (see plan §3.1)
- **processed_events** — `event_id uuid pk, action, processed_at` (offline idempotency ledger, plan §5.2)

---

## Part D — Locked decisions (confirmed)

1. **Planned workforce** → ONLY `planned_headcount` (IE, per line/day). **Remove `plannedWorkforce` from `line_styles`.** Normalize to 4 ints. (resolves trap #1)
2. **Downtime capture** → supervisor taps a **"Downtime" button** on the production screen, records **reason + time range** (e.g. 10:15–10:30). Unplanned downtime → child table `downtime_events`, many per line/day. (resolves traps #9, #35)
3. **CM/SMV freeze** → locked once ANY production row exists for that style-load; free edits (any number) only before first production. Replaces the "one-time edit" rule — enforce server-side. (resolves trap #3/#10)
4. **Salary effective-dated** → `salary_bank.effective_from`; historical KPIs use the then-current rate.
5. **No-active-style production** → BLOCK entry; remove `"s1"` fallback. (resolves trap #12)
6. **Multi-factory + Super Admin** → new `factories` table + `super_admin` role. Super Admin **creates factories and all logins**; each non-super user is tied to **exactly one factory**; **no cross-factory rollup**; Super Admin can **act-as any role of any factory** (impersonation). **`factory_id` on every table**; config/master/structure become **per-factory**. RLS isolates by factory.
7. **Downtime = paid labour → NOT subtracted from any denominator.** Downtime minutes remain in efficiency's available minutes and in cost/productivity man-hours (workers are paid). KPIs worsen naturally because piece output falls during downtime. Downtime is stored as a **separate lost-time metric** (minutes by reason). Efficiency available minutes = shift − **scheduled breaks only**. Downtime **reason** = factory-scoped managed dropdown (IE can add entries).
8. **Changeover** → exclude off-shift + scheduled-break time (plan §3.4 / R33).

### Schema impact of these decisions
- Add **`factories`** table; add `factory_id` FK to users, units, styles, salary_bank, line_styles, attendance, planned_headcount, production_hourly, downtime_events, app_settings, shift_config, break_slots, kpi_thresholds, alerts.
- Add **`super_admin`** to the role enum; `users.factory_id` null for super_admin. RLS: super_admin = all factories (+ act-as context), everyone else = own `factory_id` only.
- Config/master tables (`app_settings`, `shift_config`, `kpi_thresholds`, `salary_bank`) become **per-factory** (one row / set per factory), not global singletons.
- `line_styles`: drop `plannedWorkforce`; lock CM/SMV once a production row references the load.
- `production_hourly`: require a non-null active `style_id` (block when none). Efficiency uses `available_minutes = shift − scheduled_breaks` (downtime excluded); productivity/cost use `run_minutes = worked − downtime`.
- New **`downtime_events`** — `id, factory_id, line_id, date, start_time, end_time, reason_id→downtime_reasons, entered_by, created_at`.
- New **`downtime_reasons`** — `id, factory_id, label, active` (managed dropdown; IE can add more; seed with Machine breakdown / Power cut / No feeding / Maintenance / Other).
- `salary_bank`: add `effective_from`.

### Aggregate quantities in `line_day_agg` (from decision #7)
- `available_minutes` = shift − scheduled breaks. **Downtime NOT removed** (it stays in, so downtime drags efficiency down).
- `man_hours` for productivity & cost = full paid attendance × hours worked. **Downtime NOT removed** (paid labour).
- `downtime_minutes` = separate additive lost-time total (by reason) for reporting only — never subtracted from a KPI denominator.
