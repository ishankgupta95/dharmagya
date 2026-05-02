# SYSTEM CONTEXT: Hindu Devotional App (dharmSetu / MVP Phase)

> **Note:** This file has been trimmed to focus on **pending work only**. Completed phases (Phase 1, Phase 1.5, Phase 2, Phase 3.3, Phase 6, Phase 7.1–7.3) and stale pre-redesign screen specs have been removed — see git history and the `memory/project_*.md` files for the shipped record.

## 1. Project Objective

You are an expert React Native developer building a daily Hindu devotional app. The app must be highly performant, fully offline-capable for text data, use on-device mathematical calculations for astrological calendar data, and be heavily optimized for cross-platform support.

## 2. Current State & Tech Stack

- Current State: You are working inside an ALREADY INITIALIZED Expo project (SDK 54, RN 0.81.5). Do NOT run `npx create-expo-app` or wipe the root directory.
- Framework: Expo (with New Architecture and React Compiler enabled).
- Navigation: `expo-router` (File-based routing). Use expo-router `<Tabs>` for all tab navigation — do NOT use react-native-paper's BottomNavigation.
- State Management: Zustand (for preferences, favorites, and theme toggling).
- Panchang Engine: `@ishubhamx/panchangam-js` (Dynamic calculation of Tithi, Nakshatra, Yoga, Karana).
- Location Services: `expo-location` (To feed coordinates into the Panchang engine).
- Local Database: `expo-sqlite` — currently used **only for the muhurat scan cache** (`muhurat_cache` table). Aartis/chalisas/kathas tables were dropped; aarti + chalisa content now comes from the `hindu-devotional-texts@0.1.1` package at runtime. Favorites + preferences live in Zustand (persisted via `expo-sqlite/kv-store`).
- UI Library: `react-native-paper` (Material Design 3 — for UI components like Cards, Buttons, Surfaces only).
- Animations: `react-native-reanimated` (v4 — already installed at v4.1.1, do NOT reinstall). `react-native-gesture-handler` v2.28 also installed.
- Typography (post-P6.9.1, Sacred Editorial stack): `@expo-google-fonts/fraunces` (display serif — headlines + italic accents), `@expo-google-fonts/noto-serif-devanagari` (Devanāgarī body, 400/500/700), `@expo-google-fonts/jetbrains-mono` (mono small-caps + numeric — 400/500). **Mukta was removed in P6.9.1**; do not reinstall.
- Icons (post-P6.9.2): custom `<Icon>` component in `src/components/common/Icon.tsx` (react-native-svg, 60 glyphs). `@expo/vector-icons` is no longer a direct dep.
- App Loading: `expo-splash-screen` (already installed).

## 3. Architectural Rules & Conventions

1. TypeScript Strictness: Every component, prop, and state must have a defined interface. No `any` types.
2. Dynamic Panchang Calculation: Do NOT fetch Panchang data from an API. Use the `getPanchangam` function from `@ishubhamx/panchangam-js` passing in the current Date and user location.
3. Fallback Location: If location permissions are denied, default the Observer coordinates to Lat: 18.6298, Lon: 73.7997 for local testing accuracy.
4. Theme Toggling: Support Dark and Light modes toggled via Zustand and injected through the RN Paper Provider. Default to Dark mode (deep charcoal backgrounds, off-white text, Saffron accents).
5. Expo Router Rules: Use the `app/` directory strictly for routing/layouts. Keep UI components, store logic, and data in `src/`.
6. No babel.config.js changes needed: `react-native-reanimated` v4 does NOT require a babel plugin. Do not add `react-native-reanimated/plugin` anywhere.
7. Source structure: existing root-level `components/`, `hooks/`, and `constants/` were migrated into `src/` during Phase 1.

### 3.1 `@ishubhamx/panchangam-js` API Contract

**Package:** `@ishubhamx/panchangam-js` (v2.1.x) — pure TypeScript, no native modules, works in React Native out of the box.

**Import:**
```typescript
import { getPanchangam, Observer } from '@ishubhamx/panchangam-js';
```

**Observer constructor:**
```typescript
// Observer(latitude: number, longitude: number, elevationInMeters: number)
const observer = new Observer(18.6298, 73.7997, 560); // Pune
```

**getPanchangam call:**
```typescript
// getPanchangam(date: Date, observer: Observer, options?: { timezoneOffset?: number }): Panchangam
const panchangam = getPanchangam(new Date(), observer, { timezoneOffset: 330 }); // IST = +330 minutes
```

**Return type — `Panchangam` interface (relevant fields for MVP):**
```typescript
interface Panchangam {
  // Core — these are NUMERIC INDICES, not display strings
  tithi: number;          // 0-29 (lunar day index)
  nakshatra: number;      // 0-26 (lunar mansion index)
  yoga: number;           // 0-26 (sun-moon combination index)
  karana: string;         // string name (e.g., "Bava", "Balava", "Kaulava")
  vara: number;           // 0=Sunday, 1=Monday, ... 6=Saturday

  // Times — Date objects or null
  sunrise: Date | null;
  sunset: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  tithiEndTime: Date | null;
  nakshatraEndTime: Date | null;
  yogaEndTime: Date | null;

  // Inauspicious periods
  rahuKalamStart: Date | null;
  rahuKalamEnd: Date | null;

  // Muhurats
  abhijitMuhurta: { start: Date; end: Date } | null;
  brahmaMuhurta: { start: Date; end: Date } | null;

  // Planetary positions
  planetaryPositions: {
    sun: { rashi: number; rashiName: string; degree: number; longitude: number };
    moon: { rashi: number; rashiName: string; degree: number; longitude: number };
    // ... mars, mercury, jupiter, venus, saturn (same shape)
  };

  // Festivals
  festivals: string[];
}
```

**CRITICAL: Converting indices to display strings.** `tithi`, `nakshatra`, and `yoga` are numbers. Use the exported name arrays:
```typescript
import { tithiNames, nakshatraNames, yogaNames } from '@ishubhamx/panchangam-js';

const tithiLabel = tithiNames[panchangam.tithi];         // e.g., "Krishna Chaturdashi"
const nakshatraLabel = nakshatraNames[panchangam.nakshatra]; // e.g., "Purva Bhadrapada"
const yogaLabel = yogaNames[panchangam.yoga];             // e.g., "Siddha"
```

**Timezone handling:** Always pass `timezoneOffset: 330` (IST, +5:30) in options for Indian users. Without it, the library approximates from longitude, which can be inaccurate.

**Performance:** ~5ms per calculation. Safe to call synchronously on the JS thread.

### 3.2 `expo-sqlite` API (SDK 54+)

Use the modern synchronous API. Do NOT use the legacy `expo-sqlite/legacy` or `SQLite.openDatabase()`. The DB is wrapped via `<SQLiteProvider databaseName="dharmsetu.db" useSuspense>` in `app/_layout.tsx`; tables are managed in [`src/utils/database.ts`](src/utils/database.ts) on `onInit`.

**Current schema:** only `muhurat_cache(occasion, lat_key, lon_key, matches_json, scanned_through, updated_at)` — a rolling 365-day muhurat scan cache keyed on 0.1°-rounded coordinates. The aartis/chalisas/kathas/rashifal/meta tables previously seeded here have all been dropped on init for existing installs. Future Phase 8 (kundli, etc.) calculations should also cache through this surface, not invent a second persistence layer.

### 3.3 Path Aliases

`@/` alias points to `src/`. `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

All imports from `src/` use the alias:
```typescript
import { useStore } from '@/store/useStore';
import { IAarti } from '@/types';
import { darkTheme, lightTheme } from '@/config/theme';
```

### 3.4 Zustand Persistence

Use `zustand/middleware` persist with `expo-sqlite/kv-store` as the storage backend:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

// store shape evolves with each phase; canonical snapshot is in src/store/useStore.ts
```

### 3.5 Expo Router Dynamic Routes

Detail routes use `useLocalSearchParams<{ id: string }>()`. Navigation from list screens uses `router.push(\`/aarti/${id}\`)` etc. Already wired for aarti, chalisa, god, muhurat[occasion].

### 3.6 Project File Context

Before any structural change, inspect:
- `app.json` — existing plugins, splash config, scheme.
- `tsconfig.json` — path aliases.
- `package.json` — already-installed deps to avoid duplicates.
- Run `ls app/` and `ls app/(tabs)/` to see current route files.

Read first, then modify.

---

## 4. Design System (post-P6 — Sacred Editorial)

The MVP-era beige + saffron tokens have been fully replaced by the Sacred Editorial system. Source of truth: [`src/config/theme.ts`](src/config/theme.ts) + [`src/config/typeScale.ts`](src/config/typeScale.ts).

**Palette ground:** parchment (light) ↔ deep ink (dark). **Accent:** sindoor (light) / goldLeaf (dark) via `colors.accent`. **Emphasis:** sindoorDeep (light) / goldLeaf (dark) via `colors.emphasis`. Hardcoded `palette.*` is allowed only for CTA backgrounds, intentionally-parchment onboarding steps, content-semantic dark plinths (eclipse), and component-internal defaults all callers override. See **Phase 6 conventions** in §11 below.

**Typography:** Fraunces (display serif + italic), Noto Serif Devanagari (Devanāgarī body, 400/500/700), JetBrains Mono (mono caps + numeric).

**Spacing:** 24px screen horizontal padding; 16–20px card internal padding; 16–20px vertical card gap; 12–14px grid gap; tab bar 10px top / `Math.max(insets.bottom, 10)` bottom.

---

## 5. Screen Inventory

### 5.1 Core Screens

| #  | Screen           | Route                        |
| -- | ---------------- | ---------------------------- |
| 1  | Splash           | (pre-navigation)             |
| 2  | Home             | `app/(tabs)/index.tsx`       |
| 3  | Panchang         | `app/(tabs)/panchang.tsx`    |
| 4  | Library (Gods)   | `app/(tabs)/library.tsx`     |
| 5  | Aarti Detail     | `app/aarti/[id].tsx`         |
| 6  | Chalisa Detail   | `app/chalisa/[id].tsx`       |
| 7  | God Detail       | `app/god/[id].tsx`           |

### 5.2 Supporting Screens

| #  | Screen                 | Route / Context                |
| -- | ---------------------- | ------------------------------ |
| 8  | Settings + sub-screens | `app/settings.tsx`, `app/settings/{birth-place,deities,reminders}.tsx` |
| 9  | Favorites              | `app/favorites.tsx`            |
| 10 | Search                 | `app/search.tsx`               |
| 11 | Festivals              | `app/festivals.tsx`            |
| 12 | Dasha                  | `app/dasha.tsx`                |
| 13 | Muhurat (occasion list + detail) | `app/muhurat/index.tsx`, `app/muhurat/[occasion].tsx` |
| 14 | Onboarding (3 steps + walkthrough) | `app/onboarding/*`     |
| 15 | Location Permission    | `app/location-permission.tsx`  |

**Removed:** `app/katha/` and `app/rashifal/` — see Phase 2 note in §9.

---

## 6. Phase 1 — MVP — ✅ COMPLETED

All 17 steps of the original Phase 1 execution plan shipped (initial release). Detailed step-by-step plan removed from this file — see git history (commits prior to 2026-04-12) and the live codebase.

---

## 7. Phase 1.5 Follow-ups — Deferred Items Only

All Phase 1.5 follow-ups are shipped except:

- **Read Along Mode (auto-scroll lyrics):** ⏸️ Deferred — tied to audio track (see Phase 5).
- **Reminder toggles surface "permission denied" in Expo Go:** ⏸️ Needs dev-build verification, not Expo Go. `src/services/notifications.ts` intentionally sets `Notifications = null` in Expo Go (SDK 53 dropped Android push from Expo Go), so `requestNotificationPermission()` returns `false` and the toggle flow aborts with a misleading "allow in Settings" alert. Not a real bug — notifications genuinely don't work in Expo Go. To verify: run an EAS development build and retest toggles for Tithi/Festival reminders. Optional polish: detect Expo Go and swap the alert text to "Notifications require a development build."

---

## 8. Competitive-Gap Roadmap — Phases 2–5

**Source:** Comparative analysis against Sri Mandir, AstroSage, Drik Panchang, myMandir, Hindu Calendar (Mandavgane), etc. Goal: close the feature gap that prevents Dharmagya from moving beyond a niche reference tool, while leaning into our existing `panchang-ts` accuracy moat.

**Guiding rules for every pending phase below:**
1. Never break offline-first. Every new feature must work without a network after first install. (The original exception for Rashifal remote pulls is now moot — Rashifal was removed; see §9.)
2. Integrate with existing Zustand store, SQLite database, theme tokens, and i18n system. Do not introduce a second state/storage/theme/i18n layer.
3. Respect the ad gating rules already established (`INTERSTITIAL_MIN_GAP_MS`, `FIRST_SESSION_GRACE_MS`, never show ads before the user has engaged with content — see `feedback_no_ads_after_onboarding.md`).
4. All new text must be wired through `i18next` bundles, not hard-coded. Add keys to en/hi/sa at minimum.
5. All new calculations must be locale-aware (IST timezone, device language for display).
6. No new native modules unless a feature is impossible without one (widgets are the only Phase-2-to-4 exception).

---

## 9. Phase 2 — Daily Habit Drivers — partial state

**Currently in app:**
- ✅ **P2B Festival & Tithi Reminders** — `app/settings/reminders.tsx`, 6 tithi toggles + 5 festival-type toggles, scheduler in `src/services/notifications.ts`.
- ✅ **P2C Occasion-specific Muhurats** — `app/muhurat/index.tsx` + `[occasion].tsx`, 365-day scan with progressive streaming + SQLite cache (`muhurat_cache` table), classical rules in `src/services/astrology/muhurat.ts`.

**Shipped then removed (no longer in app):**
- ❌ **P2A Vrat Katha Library** — `kathas` table dropped on init, no `app/katha/` route, favorites migration drops `katha-*` IDs (see [`src/utils/database.ts`](src/utils/database.ts) and [`src/store/useStore.ts`](src/store/useStore.ts) v1→v2 migration).
- ❌ **P2D Daily Rashifal** — `rashifal` table dropped on init, `userRashi` field stripped from persisted store (v2→v3 migration), no `app/rashifal/` route. `userBirthDate` field is retained because it feeds future Phase 8 kundli work.

If reviving either, treat as a fresh design pass — don't assume the prior implementation can be restored from git as-is, since the surrounding redesign (Phase 6) and motion layer (Phase 7) have moved on.

---

## 10. Phase 3 — Reach Expansion (languages + content depth)

**Goal:** Unlock pan-India audiences. English + Hindi + Sanskrit cover maybe 45% of the devotional market; adding 4 more regional languages expands reach to ~80%. Also deepens the deity/content library that users browse.

**Sequencing within Phase 3:** Per `project_phase3_ordering.md` — execute **P3.3 → P3.2 → P3.1**. Language expansion is last in the sprint.

### Step P3.1: Multilingual Expansion (Marathi, Gujarati, Tamil, Telugu) — ⏳ PENDING

**Why:** Drik Panchang supports 10 languages, AstroSage 9. Without regional languages, Dharmagya cannot compete in Maharashtra, Gujarat, Tamil Nadu, Andhra/Telangana.

**Implementation:**
- Add 4 new i18n bundles: `mr` (Marathi), `gu` (Gujarati), `ta` (Tamil), `te` (Telugu). Keep existing lazy-loading — only the selected language loads at runtime.
- Translate UI strings: split into two tiers:
  - **Tier 1 (ship together with language toggle):** navigation, settings, panchang labels, notification templates, onboarding. Machine-translate via professional MT (DeepL/Google) then native-speaker QA pass for each language (budget: 1 freelancer per language for 4–6 hours).
  - **Tier 2 (ship progressively):** devotional content (aarti/chalisa translations in regional scripts) — flows through the `hindu-devotional-texts` package. These are content-heavy; translate the 10 most-popular items per language first, add rest over subsequent releases.
- Font loading: NSD covers Devanāgarī (Hindi/Marathi/Sanskrit). Add Tamil and Telugu serifs (`@expo-google-fonts/noto-serif-tamil` / `@expo-google-fonts/noto-serif-telugu`). Verify no rendering regressions on Android. For Gujarati, add `@expo-google-fonts/noto-serif-gujarati`.
- Panchang terminology: the `panchang-ts` library may not have Marathi/Gujarati/Tamil/Telugu tithi/nakshatra/yoga names built-in. Extend our own mapping tables in `src/config/panchang-labels.ts` with regional transliterations.
- Settings language picker: add 4 rows below existing en/hi/sa.
- Persist selected language in Zustand (already supported).
- **Gate:** do not ship a language publicly until Tier 1 + at least 5 devotional items in that language are QA-passed.

### Step P3.2: Deity / Aarti / Chalisa Library Expansion — ⏳ PENDING

**Why:** 20 deities is thin vs. 100+ in Sri Mandir. Content depth is a direct retention metric.

**Scope cap (per `feedback_content_accuracy_audit.md`):** Audit existing content first; **no new deities**; only fill gaps within the current 20-deity roster ([`src/config/deities.ts`](src/config/deities.ts)).

**Content source:** aarti + chalisa text comes from the [`hindu-devotional-texts`](https://www.npmjs.com/package/hindu-devotional-texts) package (currently pinned to `0.1.1`). Adding content is a library upgrade + bundle bump, not a SQLite seed migration. Kathas were removed from the app (see §9) — do not reintroduce here unless the user explicitly opts back in.

**Implementation:**
- Audit current corpus per-deity: which aartis + chalisas exist in `hindu-devotional-texts`, what's missing, accuracy of Devanagari + transliteration.
- Contribute missing items upstream to `hindu-devotional-texts`, cut a new minor version, bump in `package.json`.
- 2-step editorial review for accuracy + script correctness on every new entry.
- Library filters unchanged (sectarian chips already cover the roster).

### Step P3.3: Isht Devata Personalization — ✅ SHIPPED (2026-04-13)

Home re-ranking (Featured Aarti + Featured Chalisa prefer `selectedDeities`), "Your Deities" strip, Search re-ranking, Settings → Manage Your Deities row at [`app/settings/deities.tsx`](app/settings/deities.tsx). See `memory/project_p3_3_shipped.md` and git history.

### Phase 3 Exit Criteria

- 7 languages shipped with Tier 1 complete and Tier 2 ≥5 items each.
- Content library audited and gap-filled within the existing 20-deity roster (via `hindu-devotional-texts` upstream contribution).
- ✅ Home re-ranking live, "Your Deities" strip on Home, settings entry for re-selection (P3.3 shipped).

---

## 11. Phase 6 — Visual Redesign: "Sacred Editorial" — ✅ SHIPPED (2026-04-20)

All 10 sub-phases (P6.1 tokens → P6.10 release gate) landed 2026-04-20. Mukta dropped (P6.9.1), Ionicons dropped (P6.9.2), full theme-responsiveness sweep (P6.10). Detailed sub-phase specs and per-sub-phase decisions removed from this file — see `memory/project_p6_*.md` files and git history.

**Phase 6 conventions established (use forward in P7+ and beyond):**

- **Theme-responsive surfaces** — every card / row / icon-circle / border on a theme-responsive screen MUST use `colors.surface` / `colors.surfaceRecessed` / `colors.border` / `colors.borderAccent` / `colors.text*` / `colors.accent` / `colors.emphasis`. Hardcoded `palette.parchmentBright` / `palette.ink` / `palette.sindoor` is allowed ONLY for: (a) CTA backgrounds with light foreground text, (b) onboarding steps that are deliberately parchment-only, (c) content-semantic dark plinths (eclipse card), (d) component-internal defaults that all callers override.
- **`colors.accent`** — sindoor in light, goldLeaf in dark — for icons / mono-caps text / borders on theme-responsive surfaces.
- **`colors.emphasis`** — sindoor-deep in light, goldLeaf in dark — for body emphasis (refrain lines, italicised tail syllables, see-all links, planet glyphs).
- **Alpha-tinted alert banners** — `color + '1E'` (bg) / `+ '66'` (border) / full-color foreground. Used for festival / yoga / panchaka banners, sindoor row tints, and selected-state highlights.
- **Plain screen names, not decorative kickers.** Hero copy in [design/redesign-preview.html](design/redesign-preview.html) is typographic demo text only — use the actual screen name in `display-italic`. Add a kicker only when it surfaces real info (location, count, step counter, active month, section purpose).
- **No new deities, no roster edits, no fabricated classifications** (per `feedback_content_accuracy_audit.md`). The Library card classifications (PRESENTATION map) live screen-local.
- **No ad placement changes** during redesign sub-phases (per `feedback_no_ads_after_onboarding.md`).
- **SafeAreaView edges:** non-tab screens use `['top','bottom']`; tab screens use `['top']` only.
- **`tsc --noEmit` clean + `npx expo lint` ≤ baseline (8 warnings post-P7.1)** is the post-sub-phase gate.

**Open Phase 6 follow-up:** Device verification of dark-mode redesign, Play Store screenshots, AAB build, staged rollout. User-gated; checklist in `memory/project_p6_10_prepared.md`.

**Post-launch follow-up — Sentry crash reporting:** Add `@sentry/react-native` + `sentry-expo` config plugin **immediately after the staged rollout reaches 100%** (decision 2026-05-02). Deferred so the launch ships unblocked; Play Console's Android Vitals (crash-free rate, ANRs, stack traces) covers the rollout-watch window. What Sentry adds afterward: non-fatal JS exceptions, real-time alerts, source-mapped Hermes traces, breadcrumbs. Setup: install the plugin, register DSN, set `SENTRY_AUTH_TOKEN` as an EAS Build secret so source maps + Hermes bytecode maps upload at build time, wrap the root in `Sentry.wrap()`. Ship as a patch (`1.5.x` or `1.6.0`) — no UI surface change.

---

## 12. Phase 7 — Motion & Interaction Polish — 🟡 IN PROGRESS (P7.1–P7.3 shipped 2026-04-22)

**Why:** Phase 6 established the Sacred Editorial visual language. With those final, motion is the missing layer between "well-designed app" and "premium devotional artefact." Phase 7 must not regress any P6 visual spec, any existing screen behavior, any i18n string, or the lint baseline.

**Non-negotiable performance constraint:** Every Phase 7 animation must hold **60 fps on a Pixel 3a (4GB RAM, Android 12)**. Low-end Android is the gate. This dictates technique.

### Motion principles (carried forward into every sub-phase)

1. **Driven properties only:** `transform` (translateX / translateY / scale / rotate) and `opacity`. These are compositor-only on Fabric — zero layout / paint cost. **Never animate** `width`, `height`, `borderRadius`, `shadow*`, raw `color` (use `interpolateColor` on a worklet instead), `left`/`top`, `padding`, or `margin`. Those trigger layout and instantly drop frames on 3a-class devices.
2. **UI-thread worklets always:** `useSharedValue` + `useAnimatedStyle` + `withTiming` / `withRepeat` / `interpolate` / `interpolateColor` from `react-native-reanimated` 4.1. Never the legacy `Animated` API. Never `setInterval`/`setTimeout`-driven animation.
3. **Snappy, not spring-y:** default duration **220ms**, `Easing.out(Easing.cubic)`. Max duration for any interaction feedback is **320ms**. Ambient loops (mandala drift, ember breath) run at 2–90s but at very low magnitudes. **No overshooting springs** — they read "playful," wrong register for devotional.
4. **Stagger cap:** when staggering N items, cap total stagger time at **400ms** (e.g. 6 items × 60ms). Longer feels sluggish; the last item should never feel forgotten.
5. **Concurrency budget:** max **6 simultaneous animations per screen**. Navigating away cancels orphans (`cancelAnimation` in effect cleanup).
6. **Reduced Motion honored:** single hook `useReducedMotion()` wraps `AccessibilityInfo.isReduceMotionEnabled` + change listener. When true: durations collapse to 0 (instant), loops disabled, staggers skipped. Functionality unchanged.
7. **Haptics pair discreetly:** `Selection` on state change (tab, date, chip), `Light` on action confirmation (favorite toggle). **Never `Heavy`.** Already-installed `expo-haptics`.
8. **Gesture rules:** Gesture Handler worklets only; never conflict with vertical scroll (require either clear directional intent via velocity/displacement thresholds or non-overlapping gesture surfaces).

### Step P7.1: Motion foundation — ✅ SHIPPED (2026-04-22)

`src/config/motion.ts` + `useReducedMotion`, `useAnimatedMount`, `useEntranceStagger`, `MotionPressable` all shipped. Lint baseline now 8 (was 7). See `memory/project_p7_1_landed.md`.

### Step P7.2: System-wide micro-interactions — ✅ SHIPPED (2026-04-22)

Skeleton crossfade, FavoriteHeart (4 sites), SegmentedChip, ScreenMount on 15 screens shipped. Tab-bar ember reverted (4×4 dot too small to see the breath). See `memory/project_p7_2_landed.md`.

### Step P7.3: Editorial reveal patterns — ✅ SHIPPED (2026-04-22)

Verse stagger + refrain highlight in readers, SectionLabel settle on home, CornerBrackets draw-in in every NightCard shipped. See `memory/project_p7_3_landed.md`.

### Step P7.4: Screen-level transitions — ⏳ PENDING (next up)

**Scope:** inter-screen and intra-screen state transitions. Sacred Editorial demands **crossfades over slides** — context swaps with held type.

- **Panchang date change** — [`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx). Tapping a date cell: content area (not the calendar grid itself) `opacity 1 → 0` over 140ms, new content mounts and fades `opacity 0 → 1 + translateY 4 → 0` over 220ms. Calendar cells use P7.2 chip interpolation for selected-state change. Haptic `Selection` on cell tap.
- **Panchang horizontal swipe** — Pan gesture on the calendar hero changes day (previous / next). Commit if `|displacement| > 80px` OR `|velocity| > 400px/s`; spring back otherwise. Uses `useAnimatedGestureHandler` worklet. **Activation offset** set so vertical scroll in the screen body wins when gesture starts on a scrollable area (directional precedence via `activeOffsetX` on the Pan config).
- **Muhurat occasion card → detail delayed fade** — [`app/muhurat/index.tsx`](app/muhurat/index.tsx) → [`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx). Detail screen's title + icon mount at opacity 0, fade in over 220ms after route mount completes (simple `useEffect` + shared value). **Explicitly NOT a true shared-element transition** — those crash on Android + Fabric in RN 0.81; we keep the illusion without the risk.
- **God detail hero image fade** — [`app/god/[id].tsx`](app/god/[id].tsx). Hero photo starts at `opacity 0`, fades in over 320ms once loaded. Deity-gradient scrim stays at full opacity underneath — prevents the hard "pop" when a network / bundled image resolves.

**Exit:** panchang date changes feel cohesive (no hard flash); swipe gesture does not hijack vertical scroll; 60fps holds during rapid date navigation on Pixel 3a.

### Step P7.5: Signature moments — ⏳ PENDING

**Scope:** the few animations that define the app's character. Restrained, sacred, memorable.

- **DeityAvatar "Pranam" arrival** — [`src/components/common/DeityAvatar.tsx`](src/components/common/DeityAvatar.tsx) + god detail hero avatar. When the avatar first appears on a route-level surface (NOT in scrollable lists):
  1. Outer parchment ring: `scale 0.92 → 1 + opacity 0 → 1` over 320ms, `easings.emphasized`.
  2. Inner gold ring: same transform, delayed +120ms.
  3. Portrait: `opacity 0 → 1` at delay +240ms, 280ms duration.
  4. Total ~700ms. In library grid, the cheaper `useAnimatedMount` fade is used instead — reserving Pranam for single-focus screens.
- **Mandala watermark slow drift** — [`src/components/common/MandalaWatermark.tsx`](src/components/common/MandalaWatermark.tsx). `withRepeat(withTiming('360deg', { duration: loop.drift, easing: Easing.linear }), -1)` on the UI thread. Opacity unchanged. **Pauses when off-screen** — component subscribes to `useIsFocused` (or equivalent) and cancels the animation on blur to avoid ambient battery cost. Disabled entirely under reduced motion.
- **Muhurat result card verdict** — [`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx). When results compute, the result `NightCard` `translateY 16 → 0 + opacity 0 → 1` over 320ms. P7.3 CornerBrackets draw-in fires immediately after (stacked). Feels like a ruling settling into place.

**Exit:** Pranam arrival reads as intentional on a Pixel 3a screen capture (not jittery, not staggered-too-long); mandala drift is invisible at first glance, noticeable only on second look; reduced-motion toggle instantly stills every Phase 7 animation.

### Step P7.6: Perf QA + low-end Android gate (no new code) — ⏳ PENDING

**Device matrix:**
- **Pixel 3a (Android 12, 4GB RAM) — primary gate.** All P7 animations must hold 60 fps.
- **Samsung A14 or equivalent budget Android** — secondary gate.
- **Pixel 7 / modern iPhone** — reference only (passing on flagship proves nothing).

**Profile per screen:** React Native Performance Monitor + Hermes CPU sampling. Capture the 5 most-animated interactions: reader open, tab switch, panchang date change, deity grid scroll, god detail entry.

**Acceptance thresholds:**
- **UI FPS ≥ 58 avg, ≥ 55 p95** during any animation on Pixel 3a.
- **JS FPS ≥ 55 avg** (worklets run on UI — if JS drops, something isn't on a worklet and must be fixed).
- **No single dropped-frame event > 50ms** during any interaction.
- **Cold-start to tab-bar-visible** unchanged from pre-P7 baseline ± 50ms.

**Regression rule:** if any screen fails the gate, the offending animation is **removed**, not "optimized later." Motion is non-essential; frame rate is essential. This is the hard line.

**Reduced-motion end-to-end:** toggle Android's "Remove animations" system setting; verify every Phase 7 animation collapses to instant. Nothing should still run. Recorded on device video.

**Battery check:** mandala drift is the only continuous animation. Measure 30-min foreground drain on Pixel 3a against pre-P7 baseline. If > 2% delta, verify the off-screen pause is firing.

**Artifact:** `motion-perf.md` capturing per-screen FPS numbers + reduced-motion verification + battery delta. Checked into repo as the shipping gate.

### Phase 7 Exit Criteria

- ✅ Motion tokens + hooks shipped (P7.1).
- ✅ P7.2 system micro-interactions landed across every screen — zero regressions to P6 visual spec.
- ✅ P7.3 editorial reveals observable on reader + home without delaying first interaction.
- ⏳ P7.4 panchang date crossfade + swipe gesture working on device without conflicting with vertical scroll.
- ⏳ P7.5 signature moments (Pranam, drift, verdict) record well on a 60fps screen capture.
- ⏳ P7.6 Pixel 3a perf gate passed — all animations hold ≥ 58 UI FPS; no frame drop > 50ms.
- ⏳ Reduced-motion system setting fully respected end-to-end.
- `tsc --noEmit` clean; `npx expo lint` ≤ current baseline (8 warnings).
- App Store / Play Store: no metadata changes needed; ship as a minor version bump (`1.4.x`).

**Phase 7 conventions (forward-applicable into Phase 4):**
- **Transform + opacity only** for every new animation unless documented otherwise.
- **Worklets always**; JS-driven animation banned in new code.
- **220ms default** interaction duration — deviations must be justified inline.
- **Reduced motion in every new animated component** — no exceptions.
- **Motion tokens over magic numbers** — always import from `src/config/motion.ts`.
- **Haptics are paired, not scattered** — `Selection` on state change, `Light` on confirmation, never `Heavy`.
- **Ambient loops (>2s) must pause off-screen** — measurable battery impact otherwise.

---

## 13. Phase 4 — Native Extensions (widgets, mantra counter)

**Goal:** Add features that require more engineering effort but meaningfully differentiate Dharmagya. Order here is pragmatic: start with the lowest-native-surface-area feature and build up.

> **Important supersession:** The original P4.1 (Kundli Generation) and P4.1b (Kundli Matching) are **superseded by Phase 8 (panchang-ts library wave consumption)**. With the library shipping native Kundli + Matching + Sade Sati in Wave 2, P4.1/P4.1b collapse into "consume + render" — see [`P8.2`](#step-p82--wave-2-consumption-kundli--matching--sade-sati-5d). The original P4.1/P4.1b text has been removed from this file.

### Step P4.2: Home Screen Widgets (native modules required) — ⏳ PENDING

**Why:** Hindu Calendar by Mandavgane ships 4 widgets (moon phase, lunar date, moonrise, sunrise/sunset). Widgets drive passive daily visibility — user sees tithi without opening the app, reducing dependence on notifications. Apple and Google both weight widget-having apps higher in discovery.

**Implementation:**
- This is a known hard problem for Expo/RN apps. Use `expo-modules-core` with a custom config plugin approach:
  - **iOS:** WidgetKit extension (SwiftUI). Data is passed from RN → widget via App Groups + a JSON file written on panchang recalculation.
  - **Android:** AppWidgetProvider (Kotlin). Data passed via SharedPreferences written from RN side.
- Start with ONE widget: "Today's Panchang" — shows tithi, nakshatra, sunrise, rahu kalam. Small + medium sizes.
- Add incrementally: Festival countdown widget, Brahma Muhurta alarm widget. (Rashifal widget was on the original list — drop, since the Rashifal feature was removed; see §9.)
- Update frequency: widgets refresh on app launch + once daily at 4:00 AM local time via a background task that recomputes panchang and writes to the shared store.
- **Risk:** EAS Build config complexity. Budget 1 full sprint for the first widget. Expect iOS/Android asymmetry.
- Offline compatible: all data is computed locally, no network.

### Step P4.3: Mantra Counter (Jaap) — ⏳ PENDING

**Why:** Standard feature in devotional apps. Low effort, high-touch daily engagement moment (users open during their actual puja).

**Implementation:**
- New route: `app/jaap.tsx`.
- Large tappable circle in the center; each tap = +1 count with haptic feedback (`expo-haptics`).
- Configurable mala size (108 default, 27, 54, 216, 1008).
- Progress ring filling around the tap circle as user approaches mala completion.
- On mala completion: celebratory animation + "108 completed" toast + auto-increment mala counter.
- Persist session history in SQLite: `jaap_sessions(id, started_at, ended_at, mantra_name, mala_count, total_count)`.
- Mantra picker: preset list (Om Namah Shivaya, Om Namo Narayanaya, Gayatri, Maha Mrityunjaya, Hare Krishna, Ganesh Mantra) + "Custom" text input.
- History screen showing sessions by date with total counts.
- No ads during active jaap session. Banner ok on history screen.

### Phase 4 Exit Criteria

- ~~Kundli generation~~ — superseded by P8.2.
- At least 1 widget shipped on both iOS and Android via EAS Build.
- Mantra counter with 6 preset mantras, configurable mala size, session history.

---

## 14. Phase 5 — Far-Future (audio, booking, social) [ON HOLD]

**User directive (2026-04-12):** Hold the items below until Phases 2–4 land. They require the most operational investment (audio licensing, ops infrastructure, social moderation) and should not block competitive-parity features that deliver immediate daily-habit value.

Listed in rough priority order for when we do revisit:

### Step P5.1: Audio Playback for Aarti / Chalisa / Mantra

- The single biggest retention feature per the competitor report (Sri Mandir 5000+ tracks).
- Scope: licensed or custom-recorded tracks for the aarti + chalisa corpus shipped via `hindu-devotional-texts` (count grows with P3.2) + the mantra library built in P4.3.
- Implementation: `expo-av` or `expo-audio`, background audio entitlement (iOS/Android), lock-screen controls, offline downloads, verse-sync read-along (unblocks the deferred Phase 1 "Read Along Mode").
- Content sourcing: evaluate licensing Saregama catalog vs. commissioning fresh Gita Press-style recordings. Budget implications significant.
- CDN: Cloudflare R2 for audio hosting, progressive download + offline cache with user-controlled size limit.

### Step P5.2: Puja Booking / Astrologer Consult / E-commerce

- Sri Mandir's primary revenue driver ($12M+ ARR).
- Requires temple partnerships, payment integration (Razorpay / UPI), video proof infrastructure, operational support team, refund policies, KYC for astrologers.
- Minimum viable slice: Prasad delivery from 3 partner temples (Vaishno Devi, Tirupati, Siddhivinayak), ₹500 price point, partnered fulfillment.
- Decision point before starting: do we have an ops co-founder or external partner willing to run fulfillment? If no, do not start.

### Step P5.3: Social / Community / Sharing / Video

- **Sharing:** add native share sheet on aarti/chalisa/god detail screens — simplest, ship anytime.
- **Video content:** festival explainer videos, live aarti streams from partner temples. Requires video infra (Mux/Cloudflare Stream) and content production.
- **Community:** discussion threads per festival/deity, user-posted bhajans, moderator tooling. High moderation overhead; only pursue if the product has clear community demand signals from Phase 2–4 usage data.

---

## 15. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier (we stay ad-supported until ad revenue clearly plateaus; no rush to introduce paywall friction).
- Live streaming temple darshan (requires partnerships and 24/7 stream infra — revisit alongside P5.2).
- AI chat astrologer (hallucination risk on religious content is unacceptable; only consider with heavy guardrails and explicit "AI-generated, not from an astrologer" disclaimers, and not before P5).
- Cryptocurrency donations / NFTs / Web3 anything.

---

## 16. Phase Dependencies Summary

```
Phase 1 ✅
    ↓
Phase 2 ✅ (Daily habit drivers) ──┐
    ↓                               │
Phase 3 (Reach + content depth) ──┤
  P3.3 ✅                           │
  P3.1, P3.2 ⏳                     │
    ↓                               │
Phase 6 ✅ (Visual redesign) ←──────┤   (P6 redesign ran in parallel with
    ↓                               │    P3 content work. P7 layers motion
Phase 7 🟡 (Motion & interaction) ──┤    on top of the finished visual
  P7.1–P7.3 ✅                      │    vocabulary BEFORE P4 extensions,
  P7.4–P7.6 ⏳                      │    so widgets / mantra counter inherit
    ↓                               │    both the surface and the cadence.)
Phase 8 ⏳ (panchang-ts consumption)│
    ↓                               │
Phase 4 ⏳ (Native extensions)  ────┘
    ↓
Phase 5 (Far-future — on hold)
```

Each phase ships as its own production release. Do not bundle phases. Measure daily active users and D7 retention after each release before starting the next.

---

## 17. Phase 8 — panchang-ts Library Wave Consumption — 📐 PLANNED (scoped 2026-04-25)

**Goal.** Surface the new `panchang-ts` capabilities (Phases 28/29/30 in [panchang-ts/PLAN.md](../panchang-ts/PLAN.md) — Waves 1, 2, 3) inside dharmagya. **This is a pure consumption + UI phase** — all calculation work lives in the library.

**Sequencing.** This phase lights up incrementally as each library minor release ships. Pin `panchang-ts` to each new version as it lands, regenerate types, rebuild affected screens. The phase's three sub-phases mirror the library's three waves and **must ship in order** because Wave 2 and 3 depend on Wave 1's data shape.

**Why this is a separate phase, not part of P4.** P4 (existing) outlined Kundli as if dharmagya would do the calculation. With the library Wave 2 shipping it natively, P4.1 collapses into "consume + render" — clean, fast, and the same logic also feeds the website. P4.1 / P4.1b are **superseded** by P8.2 below; references to them in P4 stand as historical context only.

### Step P8.1 — Wave 1 consumption: DrikPanchang parity panels (~3d)

**Triggered by:** `panchang-ts` v2.4 shipped.

**Files to modify:**
- `src/services/astrology/panchangService.ts` — extend `mapToPanchangDay()` to surface new fields: `tarabala`, `varjyam`, `gandaMula`, `madhyahna`, `pratahSandhya`, `sayahnaSandhya`, `dinamanaMinutes`, `ratrimanaMinutes`, `panchakaRahita`, `doGhatiMuhurta`, plus new entries in `specialYogas` (Dwipushkar/Tripushkar/Jwalamukhi/Aadal/Vidaal/Ravi/Anandadi).
- `src/types/panchang.ts` (internal) — extend `IPanchangDay` to mirror new fields.
- `app/(tabs)/panchang.tsx` — new sections in the existing scrollable layout:
  - "Tarabala & Chandrabala" card (now both populated when user supplies birth nakshatra).
  - "Varjyam" inline warning chip in the Inauspicious section.
  - "Ganda Mula" warning banner when active.
  - "Madhyahna" + "Sandhya" rows in the Auspicious Times block.
  - Replace "Bhadra" simple banner with a richer panel that links to "Panchaka Rahita Muhurta" availability windows.
  - "Do Ghati Muhurta" — new alternate-quality system tab alongside Choghadiya / Gowri (user toggle).
- `src/components/panchang/QualitySlotsCard.tsx` — accept new `system: 'choghadiya' | 'gowri' | 'doGhati'` prop.
- `src/components/panchang/SpecialYogasCard.tsx` — handle 6 new yoga types in the icon/colour map.
- Onboarding update: in Step 1 (Deity Preference) or Settings, capture optional **birth nakshatra** so Tarabala can populate. Persist in `useUserStore`.
- i18n: add UI strings for new panel labels in `src/lib/translations.ts` (en + hi only — locked decision, no new locales this roadmap).

**Done when:** every field DrikPanchang shows on its day-panchang page also renders on dharmagya's Panchang tab. Smoke-test against drikpanchang.com for 3 cities × 3 dates.

### Step P8.2 — Wave 2 consumption: Kundli + Matching + Sade Sati (~5d)

**Triggered by:** `panchang-ts` v3.0 shipped.

**Replaces:** P4.1 + P4.1b (now obsolete).

**Files to add:**
- `app/(tabs)/kundli.tsx` — new tab (or expose under a new "Astrology" pillar grouping with existing `dasha.tsx`). Birth-input flow → renders Lagna + D1 + D9 charts + planetary positions + dignity highlights.
- `app/kundli/match.tsx` — Ashtakoot matching screen. Two birth-detail forms → 36-point breakdown + cancellations + interpretation copy.
- `app/sade-sati.tsx` — current phase + arc start/end + visual timeline. Reads natal moon rashi from the user's saved birth chart.
- `src/components/kundli/NorthChart.tsx` + `SouthChart.tsx` — SVG diamond / square chart renderers (no native deps; pure RN SVG via `react-native-svg`).
- `src/components/kundli/PlanetaryDignityChart.tsx` — Shadbala-style strip showing exalted/debilitated/own status per planet. (Full Shadbala numeric output deferred to P8.3 when library ships it.)
- `src/services/astrology/kundliService.ts` — wraps `computeRashiChart`, `computeNavamsa`, `computeAshtakoot`, `computeMangalDosha`, `computeSadeSati` with the same caching strategy as `panchangService.ts`.
- `src/store/useBirthStore.ts` — Zustand slice with SQLite persistence; supports primary user + up to 5 named charts (spouse, children, parents). Persists `{ name, dateTime, location, derived: { lagna, moonRashi, moonNakshatra } }` so derived fields are stable even if user edits inputs later.

**Files to modify:**
- `app/(tabs)/index.tsx` — Sade Sati warning chip on home if active for the user's natal moon.
- Settings: "Manage saved charts" row.
- `app/(tabs)/dasha.tsx` — wire to `useBirthStore`'s primary chart instead of one-off date picker. Add **pratyantar dasha** drilldown (third level, library now provides).
- House system selector in Settings: `'whole-sign' | 'equal' | 'placidus-kp'` (default `'whole-sign'`).
- Ayanamsa selector now includes True Chitra + Thirukanitham.

**Done when:**
- Kundli tab renders for 5 sample DOBs and matches Jagannath Hora output for D1, D9, lagna.
- Marriage matching produces same 36-point score as drikpanchang.com horoscope-match for 5 sample pairs.
- Sade Sati phase + arc dates within ±2 days of authoritative sources.

### Step P8.3 — Wave 3 consumption: Advanced + library-backed muhurat (~3d)

**Triggered by:** `panchang-ts` v3.x shipped.

**Files to remove:**
- `src/services/astrology/muhurat.ts` — **delete entirely**. All occasion logic now lives in the library's `scoreMuhurta` / `findAuspiciousDates` API.

**Files to modify:**
- `app/muhurat/index.tsx` + `app/muhurat/[occasion].tsx` — call `findAuspiciousDates(rule, range, location)` directly. Render the same UI; under the hood the score is now richer (multi-factor, library-blessed).
- `app/(tabs)/kundli.tsx` — add "Divisional charts" expandable section: D2, D3, D7, D10, D12, D30 toggle. Each calls the library's `computeDivisionalChart`.
- `app/(tabs)/kundli.tsx` — add Aspects view (Drishti map per planet) + Shadbala bar-chart panel.
- `src/components/kundli/DoshasCard.tsx` — extend to surface Kaal Sarp (with subtype) and Pitru Dosha alongside existing Mangal Dosha.
- `app/(tabs)/dasha.tsx` — add system selector: Vimshottari (default) / Ashtottari / Yogini / Chara. Each is a separate library call; render with the same timeline component.
- New: `app/calendar/index.tsx` — utility "convert Gregorian ↔ Hindu" tool, plus "Ekadashi this year" / "Sankrantis this year" / "Upcoming eclipses" lists (uses library's calendar conversion APIs).

**Done when:**
- The duplicated muhurat logic is fully gone from the app; all behaviour comes from the library and parity is verified against the previous app behaviour for 7 stock occasions.
- Divisional charts + dashas + doshas all visible inside the Kundli surface.

### Phase 8 Exit Criteria

- All three sub-phases shipped; pinned to corresponding `panchang-ts` versions.
- Existing P3 / P4 / P6 / P7 work unaffected (additive on top of the panchang screen, no visual regressions).
- Smoke-tested against drikpanchang.com (panchang values), Jagannath Hora (kundli values), and ProKerala (matching/Sade Sati values).
- App startup time and panchang screen render time **unchanged** from pre-Phase-8 baseline (library is fast; consumption is just rendering).

### Where to start (mobile)

The mobile app is **blocked on the library** — start library Phase 28 first. Once `panchang-ts` v2.2 is published with Tarabala alone, ship a tiny dharmagya release that adds the Tarabala card to the Panchang tab. That's the smallest possible end-to-end loop and exercises the full publish → bump → render pipeline. After that, batch the rest of P8.1 fields together for v2.4.
