# Sewing Floor Performance App — UI Design (Glassmorphism)

> Visual design system for a modern, mobile-first, bilingual (বাংলা / English) app built around a **glassmorphism** aesthetic — frosted translucent surfaces layered over a soft, colorful gradient, with clear hierarchy and strong readability on the factory floor.

Companion to `IMPLEMENTATION_PLAN.md`. This file defines the look, tokens, components, and per-screen layouts.

### Locked decisions
- **Logo:** `public/logo.png` (RBC). Used in top bar and login.
- **Brand color:** `#7E6FB1` (soft violet) → `--brand`. Complementary **teal `#57C4C9`** → `--brand-2`. Full palette in §3.2.
- **Theme:** **Light only** (no dark toggle) — best for a bright factory floor.
- **Target devices:** **low-end Android** → performance-first; glass is used sparingly, blur kept low, opaque fallbacks default on weak devices.
- **Data-entry screens:** **opaque** surfaces (readability first) but styled to look beautiful and modern.
- **Charts:** **Recharts**.
- **Bengali font:** **Hind Siliguri**.
- **KPI thresholds:** **IE-configurable** (good / watch / bad cutoffs set in IE settings).

---

## 1. Design Principles

1. **Glass as hierarchy, not decoration.** Translucent surfaces separate three layers: soft background context → active glass surfaces (what matters now) → solid foreground actions. Glass is a functional tool for depth and separation. *(Guidance adapted from Orizon's 2026 glassmorphism article; content rephrased for compliance.)*
2. **Readability first.** The app is used on a bright, busy floor. Text contrast and number legibility always beat visual flair. Where content is dense (tables, forms), we reduce transparency and increase opacity.
3. **Glass where it shines, solid where it doesn't.** Use glass for overlays, nav bars, KPI cards, and short summaries. Avoid heavy blur behind long forms and dense data tables. *(Adapted from Orizon; rephrased.)*
4. **Mobile-first, thumb-friendly.** One-handed use, large tap targets (min 44×44px), bottom navigation.
5. **Bilingual by design.** Every component must look right in both Latin and Bengali scripts (Bengali runs taller — leave vertical breathing room).
6. **Performance-first for low-end Android.** `backdrop-filter` blur is GPU-heavy; we cap blur low (≤12px), never stack more than two blur layers, limit glass to nav + dashboard cards, and ship an opaque fallback. A **"Lite mode"** (auto-detected on weak devices or user-toggle) replaces all glass with `glass-solid` opaque surfaces.

---

## 2. The Glass Recipe (core tokens)

Glassmorphism = **semi-transparent background + backdrop blur + thin light border + soft shadow**, over a colorful backdrop. *(Consensus definition across superdesign.dev, courseux.com, tools.town; rephrased.)*

Recommended ranges from current guidance:
- **Background alpha:** 0.15–0.30. Too opaque = solid card; too clear = text loses contrast. *(Adapted from CSS Crème; rephrased.)*
- **Blur:** 8–15px. Lower = subtle frost, higher = heavy diffusion. *(Adapted from OpenReplay; rephrased.)*
- **Border:** thin, light (1px, white at low alpha) to catch an imaginary edge.
- **Shadow:** soft and diffuse to lift the panel off the page.

### Base glass surface (CSS)
```css
.glass {
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(126, 111, 177, 0.20); /* brand-tinted soft shadow */
}

/* Fallback when backdrop-filter is unsupported or disabled */
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(255, 255, 255, 0.85); }
}
```

### Glass elevation levels
| Level | Use | Alpha | Blur |
|-------|-----|-------|------|
| `glass-1` | Nav bars, chips, pills | 0.12 | 8px |
| `glass-2` | KPI cards, list rows | 0.16 | 10px |
| `glass-3` | Modals, sheets (attendance gate) | 0.22 | 12px |
| `glass-solid` | Dense tables / long forms / **all data entry** | 0.92 | 0–4px (subtle) |

> **Low-end Android rules:** blur capped at **12px**; never stack more than **two** blurred layers; glass reserved for the top bar, bottom nav, and dashboard KPI cards. Everything data-heavy uses `glass-solid`. **Lite mode** swaps all glass → `glass-solid` when a weak device is detected or the user opts in.

---

## 3. Color System

Glass needs a **colorful, layered backdrop** to read as glass. We use a soft gradient "aurora" background with floating color blobs behind the frosted UI.

### 3.1 Background (app canvas) — aurora tuned to brand `#7E6FB1`
```css
/* Light theme aurora — lavender → periwinkle → mint, with a soft rose hint */
background:
  radial-gradient(1200px 600px at 10% 8%,  #C9BFE855, transparent),  /* lavender  */
  radial-gradient(900px 520px at 88% 15%,  #9FB8F055, transparent),  /* periwinkle*/
  radial-gradient(1000px 620px at 50% 100%,#A7E3E055, transparent),  /* mint/teal */
  radial-gradient(700px 500px at 82% 92%,  #EFC9E24D, transparent),  /* soft rose */
  linear-gradient(135deg, #F6F4FC, #EEF7FA);
```
The blobs pull directly from the brand's neighbors (violet family) so the frosted panels always float over color that flatters `#7E6FB1`.

### 3.2 Palette (light theme)
Brand `#7E6FB1` is a soft, desaturated violet. Its complement is a fresh teal, which we use as the secondary accent for contrast and energy.

| Token | Value | Use |
|-------|-------|-----|
| `--bg-from` | `#F6F4FC` | canvas gradient start (lavender white) |
| `--bg-to` | `#EEF7FA` | canvas gradient end (cool white) |
| `--brand` | `#7E6FB1` | primary actions, active nav |
| `--brand-600` | `#6B5C9E` | hover / pressed primary |
| `--brand-700` | `#554784` | brand text on light, emphasis |
| `--brand-100` | `#EEEBF7` | brand tint surface / selected row |
| `--brand-2` | `#57C4C9` | secondary accent (complementary teal), charts |
| `--brand-2-600`| `#3FA9AE` | teal hover / pressed |
| `--text` | `#241F3A` | primary text (aubergine charcoal) |
| `--text-muted` | `#6A6386` | labels, secondary text |
| `--on-glass` | `#241F3A` | text sitting on glass |
| `--hairline` | linear-gradient(90deg, `#7E6FB1`, `#57C4C9`) | tinted top edge on opaque cards |

### 3.3 Semantic / KPI status colors
Used for KPI thresholds, trends, and badges (good / watch / bad):
| Token | Color | Meaning |
|-------|-------|---------|
| `--success` | `#12B886` | on target / positive trend (teal-green, harmonizes with `--brand-2`) |
| `--warning` | `#E8A317` | watch / near threshold (amber) |
| `--danger` | `#E5484D` | below target / defect spike (soft red) |
| `--info` | `#5B76E6` | neutral info (periwinkle, sits between brand + teal) |

> Never rely on color alone. Pair status color with an icon and/or ▲▼ arrow and a text label (accessibility + colorblind safety).

**KPI thresholds are IE-configurable.** The IE sets the good / watch / bad cutoff values per KPI (e.g., efficiency ≥ 70% = success, 50–70% = watch, < 50% = danger) in IE Settings. Each KPI card maps its live value against these thresholds to pick the accent color, chip, and icon. Defaults ship out of the box and can be overridden.

---

## 4. Typography

Bilingual pairing — both scripts must render cleanly.

| Role | Latin (EN) | Bengali (বাংলা) |
|------|-----------|------------------|
| UI / body | **Inter** | **Hind Siliguri** (or Noto Sans Bengali) |
| Numerals / KPIs | **Inter** tabular figures | same |

```css
font-family: "Inter", "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif;
font-variant-numeric: tabular-nums; /* KPI numbers align in columns */
```

Type scale (mobile):
| Token | Size / Line | Use |
|-------|-------------|-----|
| `display` | 32 / 40 | big KPI number |
| `h1` | 24 / 32 | screen title |
| `h2` | 20 / 28 | section title |
| `body` | 16 / 24 | default |
| `label` | 14 / 20 | field labels, captions |
| `micro` | 12 / 16 | units, timestamps |

Bengali guidance: use line-height ≥ 1.5 (glyphs are taller), avoid ALL-CAPS (doesn't apply to Bengali), never letter-space Bengali text.

---

## 5. Spacing, Radius, Elevation

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32 (px). Base unit 4.
- **Radius:** cards 20px, buttons/inputs 14px, pills 999px, sheets 28px (top corners).
- **Shadow:** `0 8px 32px rgba(31,38,135,0.18)` for glass; lighter `0 2px 8px` for pills.
- **Safe areas:** respect iOS/Android notch + home indicator (env(safe-area-inset-*)).

---

## 6. Core Components

### 6.1 Top Status Bar (persistent, glass-1)
Sticky frosted bar across all screens.
```
[ 🅁 logo + Title ]   [ ● Online ]   [ বাং | EN ]   [ 👤 ]
```
- **Logo:** `public/logo.png` (RBC) at the left, ~28px tall.
- **Online/Offline pill:** green dot + "Online"; when offline, gray/amber dot + "Offline — syncing later". Animated pulse when syncing.
- **Language toggle:** segmented glass pill (বাং | EN), active side filled with `--brand`.
- Blurs the aurora/content scrolling beneath it.

### 6.2 Bottom Navigation (glass-1, role-based)
- 3–5 tabs depending on role, floating glass bar with rounded corners, 12px above safe area.
- Active tab: `--brand` filled icon + label; inactive: muted.
- **Supervisor:** Home · Production · Performance · Settings
- **Chief:** Home · Load Style · Performance · Settings
- **IE:** Home · Setup · Performance · Settings

### 6.3 KPI Card (glass-2) — the hero component
```
┌──────────────────────────────┐
│ Value Productivity      ⓘ     │  ← label (muted) + info
│                               │
│   1,240  ▲ 8%                 │  ← big number + trend chip
│   vs yesterday                │  ← comparison (micro)
│  ▁▂▃▅▆▇ (sparkline)           │  ← mini trend
└──────────────────────────────┘
```
- Big tabular number (`display`), colored trend chip (success/danger), sparkline in `--brand-2`.
- Tap → drills into detail / next hierarchy level.
- Status accent: thin left border or top glow in the semantic color.

### 6.4 Charts
- Library: **Recharts** (or ECharts) themed to glass — transparent chart background, soft gridlines (`rgba(255,255,255,0.15)`), gradient area fills, rounded bars.
- Types used: hourly line/area (production trend), bar (line comparison), donut (defect mix, efficiency gauge), stacked bar (attendance mix).
- Always render on a `glass-2` card, not directly on the aurora.

### 6.5 Forms & Inputs (attendance, hourly entry, salary) — opaque but beautiful
Data entry is **opaque** (`glass-solid`, ~0.92 alpha) for readability, but still modern:
- Sits on a **white/near-white card with a soft tinted top edge** (a thin `--brand`→`--brand-2` gradient hairline) so it feels connected to the glass system without the blur cost.
- Soft inner card shadow + 20px radius; the aurora still glows softly *around* the card (card is opaque, background is not).
- Large number **steppers** (− / value / +) for counts (operators, pcs) — thumb-friendly on the floor, big 56px targets.
- Floating labels, 14px labels, 16px input text (prevents mobile zoom).
- Focused field gets a `--brand` ring + subtle lift.
- Inline validation with `--danger` text + icon; success check on save.
- Result: clean, tactile, "frosted-adjacent" look that stays crisp and fast on low-end devices.

### 6.6 Attendance Gate Modal (glass-3 bottom sheet)
- Mandatory morning sheet, slides up, dimmed aurora behind.
- Four steppers: Operators / Helpers / Pressmen / Checkers, running total, big **Save & Start Day** button (`--brand`).
- Cannot dismiss until saved.

### 6.7 Buttons
| Type | Style |
|------|-------|
| Primary | Solid `--brand`, white text, radius 14px |
| Secondary | glass-2 surface, `--brand` text |
| Ghost | transparent, `--text-muted` |
| Destructive | Solid `--danger` |
- Min height 48px; full-width primary actions on mobile.

### 6.8 Drill / Hierarchy Navigation
- Breadcrumb chips (glass-1 pills): `Factory ▸ Unit 2 ▸ Floor A ▸ Line 5`.
- Each level = tappable list of glass-2 cards showing that level's KPIs; tap to go deeper.

### 6.9 Data Tables (glass-solid)
- Hourly production log, salary bank, etc. → near-opaque surface, zebra rows at low alpha, sticky header.
- Do **not** blur behind long tables (readability + performance).

### 6.10 Chips, Badges, Toasts
- Status chips (On Target / Watch / Below) with icon + color.
- Sync toast: "Saved offline — will sync" / "Synced ✓".

---

## 7. Iconography & Imagery
- **Icons:** Lucide (consistent, rounded, lightweight). Line style to match the airy glass feel.
- **Illustration:** minimal; let the aurora gradient carry the visual interest.
- **KPI glyphs:** productivity ⚡, cost 💰→(icon), efficiency 📈, profit, changeover 🔁, absenteeism 👥, quality ✓.

---

## 8. Motion
- **Entrance:** cards fade + rise 8px, staggered 40ms.
- **Glass press:** slight scale (0.98) + shadow tighten.
- **Sheet:** spring slide-up (attendance gate, style load).
- **Number changes:** count-up animation on KPI refresh.
- **Sync pulse:** online dot gently pulses while syncing.
- Respect `prefers-reduced-motion` → disable transitions.

---

## 9. Accessibility & Performance (non-negotiable)

Glass looks premium in screenshots but fails in real use if contrast, hierarchy, or performance break. *(Adapted from Orizon / setproduct; rephrased.)*

- **Contrast:** text on glass must meet WCAG AA (≥4.5:1 for body). If the aurora behind is light, darken text or raise surface alpha. Test on the busiest background.
- **Never color-only:** pair status colors with icons/labels.
- **Reduced transparency:** honor `prefers-reduced-transparency` (and low-end devices) → switch glass to `glass-solid` opaque fallback.
- **Reduced motion:** honor `prefers-reduced-motion`.
- **Tap targets:** ≥44×44px.
- **Performance budget:** max 2 stacked blur layers; blur ≤16px; avoid blurring large scrolling areas; use `will-change`/GPU hints sparingly. Provide `@supports not (backdrop-filter…)` fallback (Firefox older, low-end).
- **Full WCAG validation** requires manual testing with assistive tech and expert review — flagged, not assumed.

---

## 10. Theming
- **Light theme only** (confirmed) — optimized for a bright factory floor. No dark toggle.
- All colors via CSS variables so brand alignment + glass alpha adjust in one place.
- **Lite mode** (performance, not a color theme): swaps glass surfaces for opaque `glass-solid` on low-end devices or by user choice.
- Language preference persists per user.

---

## 11. Per-Screen Visual Layout

### 11.1 Login
- Full aurora background, centered `glass-3` card: logo, language toggle, phone/email + password, primary "Login".

### 11.2 Supervisor — Line Home
- Top bar → greeting + line name → row of KPI cards (Productivity, Efficiency, Defective %, Profit-generated) → hourly production sparkline card → "Add this hour" primary button → bottom nav.
- If attendance not done → **Attendance Gate** sheet on top.

### 11.3 Supervisor — Hourly Production Entry
- glass-solid form: hour-slot selector (from IE shift config), Good Pcs stepper, Defective Pcs stepper, Total Defects stepper → Save.
- Below: today's entered hours as glass-2 list rows.

### 11.4 Chief — Home
- Cards per owned line (glass-2), each showing mini KPIs + profit + current style chip → tap to drill.
- Floor/Unit/Factory rollup toggle at top (breadcrumb chips).

### 11.5 Chief — Load Style to Line
- glass-3 sheet: pick line → pick style → CM/pc input (local currency) → SMV input → "Load Style".

### 11.6 IE — Setup Hub
- Grid of glass-2 tiles: Factory Structure · Style Master · Salary Bank · Planned Headcount · Settings.

### 11.7 IE — Salary Bank / Settings
- glass-solid forms: salary per class + working days + standard hours; Settings has display currency (INR/BDT) + shift start/end + theme.

### 11.8 Performance Explorer (all roles)
- Breadcrumb chips → KPI card grid for current level → tap a sub-entity (unit/floor/line) to drill down → charts (trend, comparison) on glass-2 cards.

---

## 12. Implementation Notes
- Tailwind CSS with a custom theme: expose glass utilities (`.glass-1..3`, `.glass-solid`) and CSS variables for colors/alpha.
- Consider a small `<GlassCard>` React component wrapping the tokens.
- Load fonts: Inter + Hind Siliguri (self-host or Google Fonts) with `font-display: swap`.
- Keep the aurora as a fixed, non-scrolling background layer so glass always has color behind it.

---

## 13. Resolved Decisions

- ✅ **Logo** — `public/logo.png` (RBC), used in top bar + login. Aurora accents to harmonize with logo colors.
- ✅ **Theme** — light only.
- ✅ **Devices** — low-end Android; performance-first, Lite mode fallback, blur ≤12px.
- ✅ **Data entry** — opaque (`glass-solid`) but styled beautiful and modern (tinted hairline, soft shadow, big steppers).
- ✅ **Charts** — Recharts (glass-themed).
- ✅ **Bengali font** — Hind Siliguri.
- ✅ **KPI thresholds** — IE-configurable (good / watch / bad per KPI) with shipped defaults.
- ✅ **Brand palette** — `--brand #7E6FB1` (violet) + `--brand-2 #57C4C9` (complementary teal); lavender/periwinkle/mint aurora; aubergine text. See §3.2.
