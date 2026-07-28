# Sewing Floor Performance App — Implementation Plan

> Bilingual (বাংলা / English) mobile-first web app for capturing sewing line data and viewing line, floor, unit, and factory-wide performance KPIs.

---

## 1. Purpose & Vision

A simple, mobile-first app used on the sewing floor to:

- **Capture** key operational data (hourly production, attendance, defects, styles, salaries).
- **Compute** performance KPIs automatically from that captured data.
- **Show** performance at four levels of aggregation:
  1. **Line** (individual sewing line)
  2. **Floor** (group of lines)
  3. **Unit** (group of floors)
  4. **Factory** (all units combined)

The app must feel effortless for a supervisor standing on the floor with a phone. Data entry is the priority; dashboards are read-only summaries.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | **Vite** + React + TypeScript | Mobile-first, PWA-capable |
| Styling | Tailwind CSS (recommended) | Fast, consistent mobile UI |
| State/Data | React Query + local store | Cache + offline support |
| i18n | i18next (bn / en) | Full bilingual toggle |
| Backend | **Supabase** | Postgres, Auth, RLS, Realtime, Storage |
| FX rates | **open.er-api.com** (free, no key) | `https://open.er-api.com/v6/latest/USD` → USD→INR, USD→BDT. Cached daily. |
| Offline | Service Worker + local queue | Sync when back online |

> **Build order (per request):** Phase 1 builds the **frontend wireframe with mock data and full navigation** first. Supabase connection comes **after** the wireframe flow is validated.

---

## 3. Roles & Permissions

There are **three roles**. A line can have **multiple supervisors**; a line chief can own **multiple lines**.

### 3.1 IE (Industrial Engineer)
- Manages master data for the whole factory.
- **Creates & maintains styles** → enters **value per piece** (selling value per pc).
- **Maintains the Salary Bank** → salary per class: Operator, Helper, Pressman, Checker.
- Manages factory structure: Units → Floors → Lines.
- Assigns supervisors to lines and line chiefs to lines.
- **Enters planned headcount per line for the next day** (used for absenteeism man-days).
- Can view all dashboards at every level.

### 3.2 Line Chief
- Owns **one or more lines**.
- **Loads new styles onto a line** and enters the **CM value (Cost of Making per pc)** and the **SMV (standard minutes per pc)** for that style-on-line.
- Sees performance of **their lines**, plus floor / unit / factory rollups.
- Sees **profit** metrics for their lines.

### 3.3 Supervisor
- Assigned to **one or more lines**.
- **Morning attendance** — first task at login: enters count of Operators, Helpers, Pressmen, Checkers present on the line.
- **Hourly production entry** — production qty, good qty, defective pcs, total defects found.
- Sees performance of **their own line(s)** and the rollup views.
- Sees **profit generated** by the line (per hour / day / month) but **not the CM value** itself (CM is hidden).

### 3.4 Permission Matrix

| Capability | IE | Line Chief | Supervisor |
|-----------|:--:|:----------:|:----------:|
| Manage Units/Floors/Lines | ✅ | ❌ | ❌ |
| Create styles + value/pc | ✅ | ❌ | ❌ |
| Maintain salary bank | ✅ | ❌ | ❌ |
| Enter planned headcount (next day) | ✅ | ❌ | ❌ |
| Load style to line + CM + SMV | ❌ | ✅ | ❌ |
| Enter attendance | ❌ | ❌ | ✅ |
| Enter hourly production | ❌ | ❌ | ✅ |
| View own line KPIs | ✅ | ✅ (own) | ✅ (own) |
| View floor / unit / factory KPIs | ✅ | ✅ | ✅ |
| See **CM value** | ✅ | ✅ | ❌ (hidden) |
| See **profit generated** (hr/day/month) | ✅ | ✅ | ✅ |

> **Profit visibility:** Supervisors can see the **profit the line generates** (per hour, per day, per month) but the underlying **CM per pc is hidden** from them. IE and Line Chief see both.

---

## 4. Factory Hierarchy (Data Aggregation Tree)

```
Factory
 └── Unit (1..n)
      └── Floor (1..n)
           └── Line (1..n)
                ├── Supervisors (1..n)   ← many supervisors per line
                ├── Loaded Style(s) (with CM value)
                ├── Daily Attendance
                └── Hourly Production Entries
```

- A **Line Chief** maps to 1..n lines (across possibly multiple floors).
- KPIs roll **up** the tree: Line → Floor → Unit → Factory.

---

## 5. Data Model (Entities)

Draft entities for the wireframe (will become Supabase tables in Phase 2).

### Master / Structure
- **users**: id, name, role (ie | chief | supervisor), lang_pref
- **units**: id, name_en, name_bn
- **floors**: id, unit_id, name_en, name_bn
- **lines**: id, floor_id, name_en, name_bn
- **line_supervisors**: id, line_id, user_id  *(many-to-many)*
- **line_chiefs**: id, line_id, user_id  *(many-to-many; chief owns many lines)*

### IE Master Data
- **styles**: id, style_code, name, value_per_pc *(entered by IE)*
- **salary_bank**: id, class (operator | helper | pressman | checker), monthly_salary *(stored USD)*, salary_working_days, salary_standard_hours, effective_from
  - `salary_working_days` and `salary_standard_hours` are entered **with the salary data** and are used **only** to compute the hourly rate.
  - Derived: **cost per workforce hour** = monthly_salary ÷ (salary_working_days × salary_standard_hours)
  - ⚠️ `salary_standard_hours` is **NOT** the same as actual "hours worked" on the line. Actual hours worked is derived from hourly production entries and drives the KPIs; salary standard hours only converts a monthly salary into a per-hour cost.
- **planned_headcount**: id, line_id, date *(the day it applies to)*, operators, helpers, pressmen, checkers, entered_by, entered_at
  - Entered by IE the **previous day**; used for absenteeism man-days.

### Line Chief Data
- **line_styles**: id, line_id, style_id, cm_per_pc *(entered by chief)*, smv *(standard minutes per pc, entered by chief)*, loaded_at, unloaded_at
  - `loaded_at` / `unloaded_at` timestamps drive **changeover** calculation.
  - `smv` drives **efficiency**.

### Supervisor Data
- **attendance**: id, line_id, date, operators, helpers, pressmen, checkers, submitted_by, submitted_at
- **production_hourly**: id, line_id, style_id, date, hour_slot, **good_qty**, defective_pcs, total_defects_found, entered_by, entered_at
  - Only **good_qty** is entered (no separate "produced" field).
  - Derived: **Produced Qty = good_qty + defective_pcs**.

### Settings / FX
- **fx_rates**: id, base ('USD'), currency ('INR' | 'BDT'), rate, fetched_at *(cached from the FX API)*
- **app_settings**: id, display_currency ('INR' | 'BDT') *(set by IE)*
- **shift_config** (set by IE): id, shift_start, shift_end *(defines the hour slots supervisors enter against)*
  - Hour slots for production entry are generated from the IE-defined shift start/end.
- **kpi_thresholds** (set by IE): id, kpi (productivity | cost | efficiency | profit | changeover | absenteeism | defective | dhu), good_min, watch_min, direction (higher_is_better | lower_is_better)
  - Drives the good / watch / bad status color on KPI cards. Ships with sensible defaults, IE can override.

> **Money storage rule:** All monetary values (`value_per_pc`, `cm_per_pc`, `monthly_salary`, and all computed cost/profit) are **stored in USD** in the database. They are **converted to the IE-selected display currency (INR or BDT)** only in the user view, using the latest cached FX rate.

### Derived / Computed (not stored, or cached)
- KPI values per line/day, rolled up per floor/unit/factory.

---

## 6. KPI Definitions & Formulas

All KPIs update **hourly** for the running day as production entries come in.

### KPI 1 — Value Productivity
```
Value Productivity = (Produced Qty × Value per Pc) / (Total Workforce × Hours Worked)
```
- Produced Qty → sum of hourly (`good_qty` + `defective_pcs`).
- Value per Pc → from `styles.value_per_pc` (IE, stored USD).
- Total Workforce → sum of attendance classes for the line/day.
- **Hours Worked** → auto-derived from the number of hourly production slots entered (the *actual* hours the line ran). Distinct from the salary standard hours used only for cost-per-hour.

### KPI 2 — Per Piece Cost of Making
```
Per Piece Cost = (Total Workforce × Cost per Workforce Hour × Hours Worked) / Pieces Produced
```
- Cost per Workforce Hour → `monthly_salary ÷ (salary_working_days × salary_standard_hours)` from `salary_bank`.
- Hours Worked here = **actual** hours the line ran (from production entries), not the salary standard hours.
- Updates hourly as pieces & hours grow.
> **Why hours worked is included:** `cost per workforce hour` is a *per-hour rate*. Pieces accumulate all day, so without multiplying by hours the cost/pc would falsely shrink hour after hour. Including `hours worked` keeps total labor spent so far matched to total pieces made so far (see chat example). **Confirmed.**

### KPI 3 — Efficiency
```
Efficiency % = (Produced Minutes / Available Minutes) × 100
Produced Minutes  = Produced Qty × SMV        (standard minutes earned)
Available Minutes = 60 × Hours Worked × Total Workforce
```
- SMV → from `line_styles.smv`, **entered by the Line Chief when loading a new style**. **Confirmed.**

### KPI 4 — Line Profit
```
Line Value Generated = Good Qty × CM per Pc
Line Operating Cost  = Total Workforce × Cost per Workforce Hour × Hours Worked
Line Net Profit      = (Good Qty × CM per Pc) − Line Operating Cost
Per Pc Profit        = Line Net Profit / Good Qty
```
- CM per Pc → from `line_styles.cm_per_pc` (chief).
- **Visibility:** IE and Chief see CM + profit. Supervisor sees **profit generated per hour / day / month** but **not the CM value** (CM stays hidden; profit numbers are shown).

### KPI 5 — Changeover
```
Changeover Time = (Time of FIRST good piece of NEW style)
                − (Time of LAST good piece of OLD style)
```
- Show **monthly count of changeovers** and **average changeover time**.
- **Style-wise drill-down** of changeover times.

### KPI 6 — Absenteeism
```
Absenteeism % = (Absent Man-Days / Planned Man-Days) × 100
```
- Uses **man-days**: `Absent = Planned Headcount − Present (attendance)` for each line/day, summed over the period.
- Planned Headcount → from `planned_headcount`, **entered by IE the previous day**. **Confirmed.**

### KPI 7 — Quality (Defective % & DHU)
```
Produced Pcs = Good Qty + Defective Pcs
Defective %  = (Total Defective Pcs / Total Produced Pcs) × 100
DHU          = (Total Defects Found × 100) / Total Produced Pcs
```
- Fed by hourly supervisor entries (`good_qty`, `defective_pcs`, `total_defects_found`).

---

## 7. Global App Shell (all roles)

Present on every screen:

- **Top status bar**
  - App name + current level context.
  - **Online / Offline indicator** (green dot "Online" / gray "Offline — data will sync").
  - **Language toggle** (বাংলা ⇄ EN).
  - Role + user avatar / logout.
- **Bottom navigation** (role-dependent tabs).

---

## 8. Screens by Role

### 8.1 Common
1. **Login** — phone/email + password; language pre-toggle.
2. **Home / Dashboard** — role-specific landing.
3. **Performance Explorer** — drill: Factory → Unit → Floor → Line, with KPI cards & trends.
4. **Settings** — language, profile, logout.

### 8.2 Supervisor Screens
1. **Login → Attendance Gate**
   - On first login of the day, a **mandatory prompt / modal**: "Enter today's attendance to continue."
   - Fields: Operators, Helpers, Pressmen, Checkers → **Save**.
   - Cannot enter production until attendance is saved.
2. **Line Home** — today's KPI snapshot for their line(s), current loaded style, hours logged.
3. **Hourly Production Entry**
   - Select line (if multiple) + hour slot.
   - Fields: **Good Pcs Qty**, Defective Pcs, Total Defects Found. *(Produced = Good + Defective is derived automatically.)*
   - Auto-tags timestamp (used for changeover + hours worked).
   - List of already-entered hours for the day.
4. **Performance Explorer** (read-only rollups).

### 8.3 Line Chief Screens
1. **Chief Home** — cards for each owned line with live KPIs + profit.
2. **Load Style to Line**
   - Pick line → pick style (from IE master) → enter **CM per Pc** and **SMV** → Load.
   - Loading a new style closes the previous one (drives changeover).
3. **My Lines Performance** — per-line KPIs incl. profit; floor/unit/factory rollups.
4. **Changeover & Trends** — monthly changeovers, avg time, style-wise drill.

### 8.4 IE Screens
1. **IE Home** — factory overview + quick links.
2. **Factory Structure** — CRUD Units / Floors / Lines; assign supervisors & chiefs.
3. **Style Master** — create style, enter **Value per Pc**.
4. **Salary Bank** — set salary per class (Operator/Helper/Pressman/Checker) in local currency, plus **working days** and **standard working hours** (for hourly-rate calc only); shows derived cost/hour.
5. **Planned Headcount** — for each line, enter next-day planned Operators/Helpers/Pressmen/Checkers (feeds absenteeism).
6. **Settings** — set **display currency (INR / BDT)**, **shift hours (start/end)** that define the hourly production slots, and **KPI thresholds** (good/watch/bad cutoffs per KPI).
7. **All Performance** — full drill at every level.

---

## 9. Key User Flows

### 9.1 Supervisor — Daily Flow
```
Login
  → [Is attendance filled for today?]
       No  → Mandatory Attendance modal → Save → unlock app
       Yes → Line Home
  → Every hour: Hourly Production Entry (qty, good, defective, defects)
  → View live KPIs updating through the day
```

### 9.2 Line Chief — Style Load Flow
```
Login → Chief Home
  → Load Style to Line
       → select line → select style → enter CM/pc + SMV → Load
       → system stamps loaded_at (old style's last good piece = changeover anchor)
  → View My Lines Performance (incl. profit)
```

### 9.3 IE — Setup Flow
```
Login → IE Home
  → Factory Structure (create units/floors/lines, assign people)
  → Style Master (add styles + value/pc)
  → Salary Bank (set class salaries)
  → Planned Headcount (enter next-day headcount per line)
  → data now available for chiefs & supervisors
```

### 9.4 Performance Drill (all roles)
```
Factory (all units combined KPIs)
  → tap Unit → Unit KPIs
     → tap Floor → Floor KPIs
        → tap Line → Line KPIs (+ hourly trend, profit if permitted)
```

---

## 10. Bilingual (বাংলা / English)

- All labels/messages via i18n keys — never hardcoded strings.
- **Language toggle** always in top bar; persists to user profile.
- Master data (unit/floor/line/style names) stored with both `_en` and `_bn` fields where user-facing.
- Numbers/dates formatted per locale.

---

## 10b. Currency Handling (USD storage, INR/BDT display)

- **Storage:** every monetary value is stored in **USD** in the database.
- **Entry:** IE enters salary / value-per-pc, and Chief enters CM, in the **selected local currency**; the app converts to USD at the current rate before saving.
- **Display:** all money shown in the user view is converted **USD → INR or BDT** based on the **display currency set by IE** (`app_settings.display_currency`).
- **FX source:** free API `https://open.er-api.com/v6/latest/USD` (no API key). Fetch once daily, cache in `fx_rates`; fall back to last cached rate when offline.
- **Caveat to note:** because stored USD values are converted at entry time and displayed at the latest rate, historical figures can drift slightly as rates change. Acceptable for dashboards; flagged for awareness.

---

## 11. Offline / Online Handling

- **Top-bar indicator** reflects connectivity everywhere.
- Data-entry screens (attendance, hourly production) work **offline**:
  - Writes go to a **local queue** with pending status.
  - Auto-sync to Supabase when connection returns; show "syncing" then "synced".
- Dashboards show last-synced timestamp when offline.

---

## 12. Phased Implementation Plan

### Phase 1 — Frontend Wireframe (mock data) ✅ first
1. Project scaffold: Vite + React + TS + Tailwind + i18next + router.
2. App shell: top status bar (online/offline mock + lang toggle) + role-based bottom nav.
3. Auth mock + role switcher (to preview all three roles without a backend).
4. Build all screens with **mock data & local state**:
   - Supervisor: attendance gate, hourly entry, line home.
   - Chief: home, load style (CM + SMV), my-lines performance, changeover.
   - IE: structure, style master, salary bank, planned headcount.
   - Shared: performance explorer with Factory→Unit→Floor→Line drill.
5. Wire KPI calculation functions against mock data (pure functions, reusable in Phase 2).
6. Validate full navigation + flows.

### Phase 2 — Supabase Integration
1. Define schema (tables from §5) + relationships.
2. Auth (email/phone) + roles.
3. **Row-Level Security**: supervisors see own lines, chiefs see owned lines, IE sees all. CM value column not exposed to supervisor.
4. Replace mock data with Supabase queries (React Query).
5. Realtime subscriptions for live KPI updates.
6. Offline queue + sync layer.

### Phase 3 — Polish
- PWA install, performance, empty/error states, validation, reporting/export.

---

## 13. Resolved Decisions

- ✅ **SMV** — entered by the **Line Chief** when loading a new style (stored on `line_styles`).
- ✅ **Per-piece cost** — includes **hours worked** so cost accumulates correctly through the day.
- ✅ **Profit visibility** — supervisors see **profit generated** (hr/day/month); **CM value is hidden** from them.
- ✅ **Planned headcount** — entered by the **IE the previous day**, per line (feeds absenteeism).
- ✅ **Role rename** — "Admin" is now **IE (Industrial Engineer)** throughout.
- ✅ **Currency** — store in **USD**; display in **INR or BDT** per IE setting; convert via free FX API (`open.er-api.com`), cached daily.
- ✅ **Production entry** — only **Good Pcs Qty** is entered; **Produced = Good + Defective** is derived (no separate produced field).
- ✅ **Hour slots** — defined by IE via **shift start/end** in Settings; supervisors enter production against those slots.
- ✅ **Cost per workforce hour** — `monthly_salary ÷ (salary_working_days × salary_standard_hours)`; these two values are entered with the salary data and are **only** for hourly-rate calc (not actual hours worked).
- ✅ **Money entry** — entered in the **local currency (INR/BDT)** and converted to USD on save.
- ✅ **KPI thresholds** — IE-configurable good/watch/bad cutoffs per KPI (`kpi_thresholds`), with shipped defaults; drives KPI card status colors.

---

## 14. Next Step

On approval of this plan, begin **Phase 1** by scaffolding the Vite project and building the app shell + role-based navigation with mock data.
