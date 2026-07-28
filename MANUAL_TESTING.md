# Manual Testing Document — Supabase Integration

> Test the app at **http://localhost:5174/** with `VITE_DATA_SOURCE=supabase` in `.env.local`.
>
> **Test accounts** (all password: `password123`):
> | Email | Role | Sees |
> |-------|------|------|
> | `super@rbc.dev` | Super Admin | All factories, act-as any role |
> | `ie@rbc.dev` | IE | All 6 lines in factory RBC-1 |
> | `chief@rbc.dev` | Chief | Lines 1–4 (owned) |
> | `sup@rbc.dev` | Supervisor | Line 1 only |
>
> Write your **PASS / FAIL / observation** in the Result column. I'll fix all FAILs.

---

## 1. Authentication

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1.1 | Open app (cold start, no session) | Login screen shows email/password form (not role-picker) | |
| 1.2 | Enter `ie@rbc.dev` / `password123`, click Continue | Successful login → redirected to /home, IE dashboard loads | |
| 1.3 | Refresh the page (F5) | Session persists — still logged in as IE, no login screen | |
| 1.4 | Click logout (Settings → Log out) | Returns to login screen; refreshing shows login again | |
| 1.5 | Try wrong password (`ie@rbc.dev` / `wrong`) | Error message shown, stays on login | |
| 1.6 | Login as `sup@rbc.dev` | Supervisor home loads, shows Line 1 only | |
| 1.7 | Login as `chief@rbc.dev` | Chief home loads, shows Lines 1–4 | |
| 1.8 | Login as `super@rbc.dev` | Super Admin home (Factories page) loads | |

---

## 2. Dashboard KPI reads (after login)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 2.1 | IE Home: check KPI cards | Values load (not all zeros), show currency in BDT (৳) | |
| 2.2 | IE Home: switch date range to "Last 7 Days" | KPI values change (larger numbers for 7-day sum) | |
| 2.3 | IE Home: switch date range to "Last 30 Days" | KPI values change (even larger) | |
| 2.4 | IE Home: comparison chart at factory level | Bar chart shows Unit 1 vs Unit 2 with colored bars | |
| 2.5 | IE Home: drill into Unit 1 (click dropdown) | Chart shows Floor A vs Floor B | |
| 2.6 | IE Home: drill into Floor A | Chart shows Line 1 vs Line 2 | |
| 2.7 | Supervisor Home: KPI cards | Values scoped to Line 1 only; profit visible | |
| 2.8 | Chief Home: "All Lines" selected | KPIs aggregated across Lines 1–4 | |
| 2.9 | Chief Home: select specific line (e.g. Line 2) | KPIs scoped to that line only; CM visible in style card | |
| 2.10 | Performance Explorer (any role) | KPI grid + chart work with date range switching | |

---

## 3. CM Hiding (critical security requirement)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.1 | Login as `sup@rbc.dev`, go to Home | Profit KPI card visible (value shown) | |
| 3.2 | Check if CM/piece is shown anywhere on screen | CM value must NOT appear anywhere (no "CM" label with a number) | |
| 3.3 | Open browser DevTools → Network tab, find `line_styles_v` request | Response: `cm_per_pc_usd` should be `null` for all rows | |
| 3.4 | Find `get_line_kpis` RPC response | `cm_value_usd` field IS present (needed for profit calc) — that's expected | |
| 3.5 | Login as `chief@rbc.dev`, load style history | CM/piece IS visible in style cards (e.g. ৳107, ৳95) | |
| 3.6 | Login as `ie@rbc.dev`, check style cards | CM/piece IS visible | |

---

## 4. IE — Structure Management

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.1 | IE → Setup → Factory Structure tab | Shows Unit 1, Unit 2 with floors and lines | |
| 4.2 | Click "Add Unit" → enter name "Unit 3" → Save | Unit 3 appears in the list | |
| 4.3 | Refresh page | Unit 3 persists (came from DB) | |
| 4.4 | Add a floor to Unit 3 | Floor appears | |
| 4.5 | Add a line to that floor | Line appears | |
| 4.6 | Delete the line | Line disappears | |
| 4.7 | Delete the floor | Floor + any lines disappear | |
| 4.8 | Delete Unit 3 | Unit disappears | |
| 4.9 | Refresh → confirm deletions persisted | All clean, back to original structure | |

---

## 5. Supervisor — Attendance Entry

| # | Step | Expected | Result |
|---|------|----------|--------|
| 5.1 | Login as `sup@rbc.dev` | If attendance not filled today → Attendance Gate modal appears | |
| 5.2 | Set operators=20, helpers=5, pressmen=2, checkers=2 → Save | Gate closes, home dashboard loads | |
| 5.3 | Open DevTools Network → look for `sync_attendance` RPC call | POST to `rpc/sync_attendance` should return 200 | |
| 5.4 | IE Home or Performance → check absenteeism | Should reflect the new attendance (planned=36, present=29 → ~19% absent) | |
| 5.5 | Supervisor → Attendance tab → edit today's entry | Changes save and sync | |
| 5.6 | Refresh page → go to Attendance History | Today's entry shows the updated values | |

---

## 6. Supervisor — Hourly Production Entry

| # | Step | Expected | Result |
|---|------|----------|--------|
| 6.1 | Supervisor → Production tab | Running style card visible; hour slots shown | |
| 6.2 | Set Inspected=130, Defective=5, Defects=7 for current hour slot → Save | "Hour saved" flash; entry appears in today's list | |
| 6.3 | Check Network → `sync_production` RPC | Returns 200 | |
| 6.4 | Go to Home → check KPIs | Values update to reflect the new production | |
| 6.5 | Enter the same hour slot again with different values | Should UPDATE (not duplicate) — only one row per slot | |
| 6.6 | Refresh page → Production History | Today shows the correct (latest) values for that slot | |

---

## 7. Supervisor — Downtime Logging

| # | Step | Expected | Result |
|---|------|----------|--------|
| 7.1 | Production screen → "Log Downtime" button | Downtime modal opens | |
| 7.2 | Select reason (e.g. Machine breakdown), set 14:00–14:25, optional note → Save | "Downtime logged" flash; appears in today's downtime list | |
| 7.3 | Check Network → `sync_downtime` RPC | Returns 200 | |
| 7.4 | Go to Home → check downtime-related metrics | Downtime minutes visible (if displayed) | |

---

## 8. Chief — Load Style

| # | Step | Expected | Result |
|---|------|----------|--------|
| 8.1 | Login as `chief@rbc.dev` → Load Style tab | Form shows: line picker, style picker, CM input, SMV input, workforce | |
| 8.2 | Pick a line, pick a style, set CM=120, SMV=16, workforce → "Load Style" | "Style loaded" flash | |
| 8.3 | Check Network → `sync_load_style` RPC | Returns 200 | |
| 8.4 | Go to Home → that line | Should show the new style running (or queued if old one was active) | |
| 8.5 | Refresh → check style persists | Style card shows the loaded style with correct CM/SMV | |

---

## 9. Offline → Sync cycle

| # | Step | Expected | Result |
|---|------|----------|--------|
| 9.1 | Login as supervisor; open DevTools → Network → set "Offline" | Top bar should show "Offline" indicator | |
| 9.2 | Enter a production hour (any values) | Saves locally (no network call), flash "Hour saved" | |
| 9.3 | Open DevTools → Application → IndexedDB → `rbc_outbox` | Should see 1 pending event with status "pending" | |
| 9.4 | Go back online (uncheck Offline in DevTools) | Within 30s (or immediately): `sync_production` fires, event disappears from outbox | |
| 9.5 | KPIs on Home update after sync | Values reflect the newly synced production | |
| 9.6 | Repeat step 9.2–9.4 with same hour slot | Idempotent: no duplicate row; second call is a no-op server-side | |

---

## 10. Realtime (live updates)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 10.1 | Login as supervisor in one browser; login as IE in another | Both sessions active | |
| 10.2 | Supervisor enters a production hour | KPIs on supervisor home update | |
| 10.3 | Check IE's dashboard (without manually refreshing) | IE's KPIs should update within a few seconds (realtime invalidation) | |
| 10.4 | If IE doesn't auto-update: click away and come back (focus trigger) | Should refetch and show updated values | |

---

## 11. FX & Currency

| # | Step | Expected | Result |
|---|------|----------|--------|
| 11.1 | Check displayed currency on KPI cards | Should show ৳ (BDT) as the IE setting is BDT | |
| 11.2 | IE → Setup → Currency tab → switch to INR | Currency changes to ₹ across the app | |
| 11.3 | All money values recalculate at the INR rate | Values change proportionally | |
| 11.4 | Check FX rates in DB (optional: run `select * from fx_rates` in Supabase SQL editor) | Today's rates exist for INR and BDT | |

---

## 12. Edge cases & error handling

| # | Step | Expected | Result |
|---|------|----------|--------|
| 12.1 | Try entering production with no style loaded on a line | Entry should be blocked (or fail gracefully) — no "s1" fallback | |
| 12.2 | IE edits a style's value/pc | KPIs should recalculate (trigger updates summary) | |
| 12.3 | Chief tries to edit CM/SMV after production was entered against that style | Should be rejected (freeze trigger) — error shown or edit locked | |
| 12.4 | Supervisor tries to access /setup or /load URL directly | Should see limited/no data (RLS scopes) or be redirected | |
| 12.5 | Open the app in 2 tabs as supervisor, enter data in one | Other tab should reflect changes on focus/interaction | |
| 12.6 | Login with `super@rbc.dev`, click "Enter as IE" on a factory | App should switch to IE mode for that factory | |

---

## 13. Performance & UX

| # | Step | Expected | Result |
|---|------|----------|--------|
| 13.1 | Initial page load time (cold, after login) | < 3s on broadband; loading spinner visible briefly | |
| 13.2 | Navigate between tabs (Home → Production → Performance) | Smooth, no jank; lazy chunks load fast | |
| 13.3 | Date range "Last 30 Days" on IE dashboard (6 lines × 30 days) | Response < 1s (single RPC call) | |
| 13.4 | Language toggle (EN ↔ বাং) | All labels switch correctly; no layout break | |

---

## Summary

| Section | Total tests | Pass | Fail | Notes |
|---------|-------------|------|------|-------|
| 1. Auth | 8 | | | |
| 2. KPI reads | 10 | | | |
| 3. CM hiding | 6 | | | |
| 4. IE structure | 9 | | | |
| 5. Attendance | 6 | | | |
| 6. Production | 6 | | | |
| 7. Downtime | 4 | | | |
| 8. Load Style | 5 | | | |
| 9. Offline sync | 6 | | | |
| 10. Realtime | 4 | | | |
| 11. FX/Currency | 4 | | | |
| 12. Edge cases | 6 | | | |
| 13. Performance | 4 | | | |
| **TOTAL** | **78** | | | |

---

## How to report bugs

For each FAIL, note:
1. **Test #** (e.g. 6.3)
2. **What happened** (error message, screenshot, network response)
3. **Console errors** (copy from DevTools → Console)
4. **Network tab** (copy the failing request URL + response body)

Paste all of these together and I'll fix them in batch.
