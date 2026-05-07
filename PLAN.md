# SYSTEM CONTEXT: Hindu Devotional App (dharmSetu / MVP Phase)

> **Note:** Done phases are summarized in §6 below. Full sub-phase decisions live in `memory/project_*.md` files and git history. Pending work is in §7 onward, ordered by priority — **optimizations + features first, language support last.**

## 1. Project Objective

You are an expert React Native developer building a daily Hindu devotional app. The app must be highly performant, fully offline-capable for text data, use on-device mathematical calculations for astrological calendar data, and be heavily optimized for cross-platform support.

## 2. Current State & Tech Stack

- Current State: You are working inside an ALREADY INITIALIZED Expo project (SDK 54, RN 0.81.5). Do NOT run `npx create-expo-app` or wipe the root directory.
- Framework: Expo (with New Architecture and React Compiler enabled).
- Navigation: `expo-router` (File-based routing). Use expo-router `<Tabs>` for all tab navigation — do NOT use react-native-paper's BottomNavigation.
- State Management: Zustand (for preferences, favorites, and theme toggling).
- Panchang Engine: `panchang-ts`. Source of truth for tithi/nakshatra/yoga/karana/muhurat/kundli/dasha/dosha.
- Location Services: `expo-location` (To feed coordinates into the Panchang engine).
- Local Database: `expo-sqlite` — currently used for the muhurat scan cache (`muhurat_cache` table) and (future) the Jaap session table. Aartis/chalisas come from the `hindu-devotional-texts` package at runtime. Favorites + preferences live in Zustand (persisted via `expo-sqlite/kv-store`).
- UI Library: `react-native-paper` (Material Design 3 — for UI components like Cards, Buttons, Surfaces only).
- Animations: `react-native-reanimated` v4.1.1 + `react-native-gesture-handler` v2.28 (already installed; do NOT reinstall).
- Typography (post-P6.9.1): `@expo-google-fonts/fraunces` (display serif), `@expo-google-fonts/noto-serif-devanagari` (Devanāgarī body), `@expo-google-fonts/jetbrains-mono` (mono caps + numeric). **Mukta is removed**; do not reinstall.
- Icons (post-P6.9.2): custom `<Icon>` component in `src/components/common/Icon.tsx` (react-native-svg, 60 glyphs). `@expo/vector-icons` is no longer a direct dep.
- App Loading: `expo-splash-screen` (already installed).

## 3. Architectural Rules & Conventions

1. TypeScript Strictness: Every component, prop, and state must have a defined interface. No `any` types.
2. Dynamic Panchang Calculation: Do NOT fetch from an API. Use `panchang-ts` directly with the user's date/location.
3. Fallback Location: If location permissions are denied, default coordinates to Lat: 18.6298, Lon: 73.7997.
4. Theme Toggling: Support Dark and Light modes via Zustand. Default to Dark mode (deep ink + parchment + sindoor/goldLeaf accent).
5. Expo Router Rules: Use `app/` strictly for routing/layouts. Keep UI components, store logic, and data in `src/`.
6. No babel.config.js changes needed: `react-native-reanimated` v4 does NOT require a babel plugin.
7. Source structure: existing root-level `components/`, `hooks/`, and `constants/` were migrated into `src/` during Phase 1.

### 3.1 `panchang-ts` API Contract

Pure TypeScript, no native modules, RN-compatible. Wraps as `getPanchangam`, `computeKundli`, `computeAshtakoot`, `computeMangalDosha`, `computeKaalSarp`, `computePitruDosha`, `computeSadeSati`, `computeShadbala`, `computeDignity`, `computeVimshottariDashaFromBirth`, `computeAshtottariDasha`, `computeYoginiDasha`, `computeCharaDasha`, `computeDivisionalChart`, `scoreMuhurta`, etc. Library handles ayanamsa, house system, varga math; consumers cache via LRU keyed on input hash. See [`src/services/astrology/`](src/services/astrology/) for the existing wrapper pattern.

**Timezone handling:** birth times are wallclock-in-birthplace-tz. Always pass through [`src/utils/time.ts`](src/utils/time.ts) `wallclockInZoneToUtc` before handing to library — `new Date('YYYY-MM-DDTHH:mm:00')` parses in device tz, which breaks any user travelling outside India.

**Performance:** ~5–20ms per kundli compute. LRU caches keep re-renders cheap.

### 3.2 `expo-sqlite` API (SDK 54+)

Use the modern synchronous API. Do NOT use the legacy `expo-sqlite/legacy` or `SQLite.openDatabase()`. The DB is wrapped via `<SQLiteProvider databaseName="dharmsetu.db" useSuspense>` in `app/_layout.tsx`; tables are managed in [`src/utils/database.ts`](src/utils/database.ts) on `onInit` and gated by `PRAGMA user_version`. Currently at version 2 (post-1.7.0).

**Current schema:** `muhurat_cache(occasion, lat_key, lon_key, matches_json, scanned_through, updated_at)` — 365-day rolling muhurat scan cache. New tables for future features (e.g. `jaap_sessions`) cache through this surface, not a separate persistence layer.

### 3.3 Path Aliases

`@/` alias points to `src/`. All imports from `src/` use the alias.

### 3.4 Zustand Persistence

`zustand/middleware` persist with `expo-sqlite/kv-store` as backend. Canonical snapshot in [`src/store/useStore.ts`](src/store/useStore.ts); secondary chart slice in [`src/store/useBirthStore.ts`](src/store/useBirthStore.ts).

### 3.5 Project File Context

Before any structural change, inspect `app.json`, `tsconfig.json`, `package.json`, `ls app/`, `ls app/(tabs)/`. Read first, then modify.

---

## 4. Design System (post-P6 — Sacred Editorial)

Source of truth: [`src/config/theme.ts`](src/config/theme.ts) + [`src/config/typeScale.ts`](src/config/typeScale.ts).

**Palette ground:** parchment (light) ↔ deep ink (dark). **Accent:** sindoor (light) / goldLeaf (dark) via `colors.accent`. **Emphasis:** sindoorDeep / goldLeaf via `colors.emphasis`. Hardcoded `palette.*` allowed only for CTA backgrounds, parchment-only onboarding steps, content-semantic dark plinths (eclipse), and component-internal defaults all callers override.

**Typography:** Fraunces (display serif + italic), Noto Serif Devanagari (Devanāgarī body, 400/500/700), JetBrains Mono (mono caps + numeric).

**Spacing:** 24px screen horizontal padding; 16–20px card internal padding; 16–20px vertical card gap; 12–14px grid gap; tab bar 10px top / `Math.max(insets.bottom, 10)` bottom.

**Phase 6 conventions (forward-applicable):**
- Theme-responsive surfaces use `colors.surface` / `colors.surfaceRecessed` / `colors.border` / `colors.text*` / `colors.accent` / `colors.emphasis`. Hardcoded palette only in the four exceptions above.
- Alpha-tinted alert banners: `color + '1E'` (bg) / `+ '66'` (border) / full-color foreground.
- Plain screen names, not decorative kickers (per `feedback_no_decorative_taglines.md`).
- No new deities (per `feedback_content_accuracy_audit.md`); 19-deity roster is fixed.
- SafeAreaView edges: non-tab screens `['top','bottom']`; tab screens `['top']`.
- Post-task gate: `tsc --noEmit` clean + `npx expo lint` ≤ 8 warnings.

**Phase 7 conventions (forward-applicable):**
- Transform + opacity only — never `width`/`height`/`borderRadius`/raw `color`.
- Worklets always (`react-native-reanimated` 4.1). Never the legacy `Animated` API or `setInterval`-driven animation.
- 220ms default duration, `Easing.out(Easing.cubic)`. Max 320ms for interaction feedback.
- Stagger cap 400ms total; max 6 simultaneous animations per screen.
- Reduced motion respected via `useReducedMotion()` hook in every animated component.
- Haptics paired: `Selection` on state change, `Light` on confirmation. Never `Heavy`.
- Ambient loops > 2s pause off-screen.

---

## 5. Screen Inventory

### Core
| #  | Screen           | Route                        |
| -- | ---------------- | ---------------------------- |
| 1  | Splash           | (pre-navigation)             |
| 2  | Home             | `app/(tabs)/index.tsx`       |
| 3  | Panchang         | `app/(tabs)/panchang.tsx`    |
| 4  | Library (Gods)   | `app/(tabs)/library.tsx`     |
| 5  | Astrology        | `app/(tabs)/astrology.tsx`   |
| 6  | Aarti Detail     | `app/aarti/[id].tsx`         |
| 7  | Chalisa Detail   | `app/chalisa/[id].tsx`       |
| 8  | God Detail       | `app/god/[id].tsx`           |

### Supporting
| #  | Screen                 | Route / Context                |
| -- | ---------------------- | ------------------------------ |
| 9  | Settings + sub-screens | `app/settings.tsx`, `app/settings/{birth-place,deities,reminders}.tsx` |
| 10 | Favorites              | `app/favorites.tsx`            |
| 11 | Search                 | `app/search.tsx`               |
| 12 | Festivals              | `app/festivals.tsx`            |
| 13 | Kundli Match           | `app/kundli/match.tsx`         |
| 14 | Muhurat                | `app/muhurat/index.tsx`, `app/muhurat/[occasion].tsx` |
| 15 | Onboarding             | `app/onboarding/*` (3 steps + walkthrough) |
| 16 | Location Permission    | `app/location-permission.tsx`  |

**Removed:** `app/katha/`, `app/rashifal/`, standalone `app/dasha.tsx` (now folded into Astrology tab).

---

## 6. Shipped phases — summary

All phase decisions and per-sub-phase notes live in `memory/project_*.md`.

- **Phase 1 — MVP** ✅. All 17 steps shipped (initial release).
- **Phase 1.5 — Follow-ups** ✅ except: Read-Along Mode (deferred — tied to P5.1 audio), Expo Go reminder verification (needs dev build, not Expo Go).
- **Phase 2 — Daily habit drivers** ✅ partial. P2B reminders + P2C muhurats shipped. P2A vrat katha and P2D rashifal removed (tables dropped on init; do not revive without fresh design — see git log).
- **Phase 3.3 — Isht Devata personalization** ✅ (2026-04-13). Home re-ranking, "Your Deities" strip, Search re-ranking, Settings → Manage Your Deities.
- **Phase 6 — Sacred Editorial redesign** ✅ (2026-04-20). All 10 sub-phases. Mukta + Ionicons fully dropped; theme tokens drive everything.
- **Phase 7.1–7.3 — Motion foundation + system micro-interactions + editorial reveals** ✅ (2026-04-22). Motion tokens, FavoriteHeart, SegmentedChip, ScreenMount, verse stagger, refrain highlight, CornerBrackets draw-in.
- **Phase 8.1 — panchang-ts v2.4 surface** ✅ (2026-05-01). Tarabala, Varjyam, Ganda Mula, Madhyahna, Sandhya, Do Ghati, ayanamsa setting, Chandra Balam, Adhika Masa, instant snapshot, eclipses, GRAHA_ABBR chip, PanchangError diagnostics.
- **Phase 8.2 — Kundli + Matching + Sade Sati** ✅ (shipped in 1.7.0, 2026-05-06). Astrology tab, North + South charts, D1 + D9, doshas (Mangal + Kaal Sarp + Pitru), Ashtakoot match with saved-charts store, Sade Sati banner, chart style + house system selectors, True Chitra + Thirukanitham ayanamsas.
- **Phase 8.3 (most of)** ✅ (1.7.0, 2026-05-06). Divisional D2–D30, four dasha systems (Vimshottari/Ashtottari/Yogini/Chara), Shadbala chart, library-backed muhurat (custom RULES dropped, `scoreMuhurta` is source of truth), bundled-candidate fast path, instant-cache render. **Remaining:** Aspects view (now in §10).
- **panchang-ts 3.1.0 surface** ✅ (2026-05-06). Kaal Sarp + Pitru doshas, Shadbala, D2–D30 divisional charts, Ashtottari/Yogini/Chara dashas wired up.
- **1.7.0 Play Store launch** ✅. Screenshots, AAB, staged rollout. Bug fixes flagged 2026-05-06 all resolved (muhurat low-end perf, walkthrough off-screen clamp, screenshots).
- **Phase 9 — Panchang Densification** ✅ (2026-05-06 → 2026-05-07). The originally-scoped fullscreen calendar route was reversed; instead the Panchang tab was densified into a "Sacred Almanac" ledger. Shipped: layout toggle (compact ↔ dense transposed grid) persisted in Zustand, lazy `useLazyDailyPanchang` hook (daily compute deferred until first accordion expand), category accordions (Pancha Anga / Sun & Moon / Auspicious / Inauspicious / Eclipse / Time Quality / For You / Planetary), glance section reading from `CalendarDay` snapshot only, Pancha Anga "Sacred Almanac entry" redesign (italic Fraunces kickers replacing 96pt mono-caps label column; auto static/dynamic limb modes), full Hi localisation in dense cells (tithi / paksha / event / Devanagari numerals), default-open Pancha Anga, store v12/v13 migrations (`panchangCategoriesOpen` reset, `xl`/`xxl` font sizes dropped). Yearly drilldown lists (Ekadashi / Sankranti / Upcoming Eclipses) bundled into [`src/services/astrology/calendarService.ts`](src/services/astrology/calendarService.ts).
- **P4.2 — Today's Panchang widget (Android scaffold)** ✅ (2026-05-06). Android-only AppWidgetProvider drop with system fonts + dark register + foreground+tap-refresh. **iOS WidgetKit deferred** (see §11).

---

## 7. Pending — Sentry post-launch ⏳

Add `@sentry/react-native` + `sentry-expo` config plugin (decision 2026-05-02). Free Developer plan (5K errors/mo, 50 replays, 30-day retention) is sufficient at current scale; revisit only if usage actually overflows.

Setup: install plugin, register DSN, set `SENTRY_AUTH_TOKEN` as EAS Build secret so source maps + Hermes bytecode maps upload at build time, wrap root in `Sentry.wrap()`. Ship as a patch — no UI surface change.

Half-day of work. **Deferred until staged rollout reaches 100%** — Play Vitals covers the launch window.

---

## 8. Pending — Phase 7 finishing (P7.4–P7.6)

P7.1–P7.3 shipped; conventions established (see §4 above). P7.4–P7.6 remain. **Not blocking shipping more features** — these are polish + verification phases. Pick up once feature velocity has slowed.

### P7.4 — Screen-level transitions ⏳

Sacred Editorial demands **crossfades over slides** — context swaps with held type.

- **Panchang date change** ([`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx)) — content area `opacity 1→0` (140ms), new content `opacity 0→1 + translateY 4→0` (220ms). Calendar cells reuse P7.2 chip interpolation. Haptic `Selection` on cell tap.
- **Panchang horizontal swipe** — pan-gesture day change. Commit if `|dx| > 80px` OR `|v| > 400px/s`; spring back otherwise. `useAnimatedGestureHandler` worklet. `activeOffsetX` so vertical scroll wins on scrollable bodies.
- **Muhurat occasion → detail delayed fade** — title + icon fade in over 220ms after route mount completes. **Not** a true shared-element transition (those crash on Android + Fabric in RN 0.81).
- **God detail hero image fade** — hero photo `opacity 0→1` over 320ms once loaded. Deity-gradient scrim at full opacity underneath.

**Exit:** date changes feel cohesive (no flash); swipe doesn't hijack vertical scroll; 60fps holds during rapid date navigation on Pixel 3a.

### P7.5 — Signature moments ⏳

The few animations that define the app's character. Restrained, sacred, memorable.

- **DeityAvatar "Pranam" arrival** ([`src/components/common/DeityAvatar.tsx`](src/components/common/DeityAvatar.tsx)) — outer ring `scale 0.92→1 + opacity 0→1` (320ms, `easings.emphasized`), inner ring same +120ms delay, portrait `opacity 0→1` at +240ms. Total ~700ms. Used on route-level surfaces only; library grid uses cheaper `useAnimatedMount` fade.
- **Mandala watermark drift** ([`src/components/common/MandalaWatermark.tsx`](src/components/common/MandalaWatermark.tsx)) — `withRepeat(withTiming('360deg', { duration: loop.drift, easing: linear }), -1)` on UI thread. Pauses when off-screen via `useIsFocused`. Disabled under reduced motion.
- **Muhurat result card verdict** ([`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx)) — result `NightCard` `translateY 16→0 + opacity 0→1` (320ms). P7.3 CornerBrackets draw-in fires immediately after.

**Exit:** Pranam reads intentional on Pixel 3a screen capture; mandala drift invisible at first glance, noticeable on second look; reduced-motion toggle stills every animation instantly.

### P7.6 — Perf QA + low-end Android gate (no new code) ⏳

**Device matrix:** Pixel 3a (Android 12, 4GB) is the gate. Samsung A14 secondary. Pixel 7 / iPhone reference only.

**Profile per screen** with RN Performance Monitor + Hermes CPU sampling on the 5 most-animated interactions: reader open, tab switch, panchang date change, deity grid scroll, god detail entry.

**Acceptance thresholds:**
- UI FPS ≥ 58 avg, ≥ 55 p95 during animation on Pixel 3a.
- JS FPS ≥ 55 avg.
- No single dropped-frame event > 50ms.
- Cold-start to tab-bar-visible unchanged from pre-P7 baseline ± 50ms.

**Regression rule:** offending animation is **removed**, not "optimized later." Frame rate is essential; motion isn't.

**Reduced-motion E2E:** toggle Android "Remove animations" → every Phase 7 animation collapses to instant. Recorded on device video.

**Battery:** mandala drift is the only continuous animation. 30-min foreground drain delta vs. pre-P7 baseline ≤ 2%.

**Artifact:** `motion-perf.md` with per-screen FPS + reduced-motion verification + battery delta. Checked into repo as the shipping gate.

### Phase 7 Exit Criteria

- ✅ P7.1–P7.3 shipped.
- ⏳ P7.4 panchang crossfade + swipe gesture without scroll conflict.
- ⏳ P7.5 signature moments record well on 60fps capture.
- ⏳ P7.6 Pixel 3a perf gate passed; no frame drop > 50ms.
- ⏳ Reduced-motion respected E2E.
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings.

---

## 9. Pending — Phase 3 — Multilingual Expansion (P3.1) ⏳

**Sequencing note:** Languages are last in the active queue. Will be its own dedicated PR after current feature work lands. Regional rollout is content-heavy and shouldn't compete with feature velocity.

**Why:** Drik Panchang supports 10 languages, AstroSage 9. Without regional languages we can't compete in Maharashtra, Gujarat, Tamil Nadu, Andhra/Telangana.

**Implementation:**
- Add 4 i18n bundles (`mr`, `gu`, `ta`, `te`); existing lazy-load retained.
- Translate UI strings — Tier 1 (nav, settings, panchang labels, notification templates, onboarding) ships with the language toggle. MT (DeepL/Google) + native-speaker QA (1 freelancer × 4–6h per language).
- Font loading: NSD already covers Devanāgarī (Marathi). Add `@expo-google-fonts/noto-serif-tamil`, `noto-serif-telugu`, `noto-serif-gujarati`. Verify no Android rendering regressions.
- Panchang terminology: extend `src/config/panchang-labels.ts` with regional transliterations (tithi/nakshatra/yoga).
- Settings language picker: 4 new rows below en/hi/sa.
- **Gate:** do not ship a language publicly until Tier 1 UI strings are QA-passed and devotional content for that language exists in the consumed text package.

**Order:** Marathi first (largest contiguous market, NSD already loaded), then Gujarati, then Tamil, then Telugu. One language per release.

### Phase 3 Exit Criteria

- 4 new languages shipped with Tier 1 UI strings complete and per-language gating cleared.

---

## 10. Active — Phase 10 — Detailed Calendar + Aspects + Mantra Counter (this PR, scoped 2026-05-07)

**Why now:** Following the Phase 9 panchang densification (see §6), three high-impact features remain that pair well into a single release: a landscape "see whole month with rich cells" calendar surface, a planetary aspects (Drishti) view that finally surfaces `bundle.aspects` data, and the long-pending mantra counter (originally P4.3). All three are app-internal, no native modules, no platform asymmetry.

### Step P10.1 — Landscape detailed calendar route (~half day) ⏳

**File:** new route `app/calendar-detail.tsx`.

**Why:** the dense Panchang grid (transposed, 7 weekday rows × 6 week cols) shows whole-month at a glance but each cell can only carry day# + tithi + 1 event line. A separate landscape route gives the desktop-style 7-col × 6-row monthly grid where each cell is wide enough to carry day# + tithi until-time + nakshatra + yoga + sunrise/sunset + Rahu kalam + festival pip — the "complete printed almanac page" experience.

**Orientation strategy:**
- App stays `"orientation": "portrait"` in [app.json](app.json) (current).
- Add `expo-screen-orientation` package.
- The detail-calendar route locks `LANDSCAPE` on mount (`ScreenOrientation.lockAsync(LANDSCAPE)`), restores `PORTRAIT_UP` on unmount.
- One-line hint in route header (`"Rotate for best view"` / `"बेहतर दृश्य के लिए घुमाएँ"`) if the device is held portrait; respect system "Auto-rotate off" — content renders in landscape regardless of phone orientation in that case.

**Layout (landscape viewport, ~810pt × 360pt typical):**
- Editorial month header (display-italic, lang-aware month name + Vikram Samvat + "Based on {{location}}" footer chip).
- Weekday column headers across the top (SUN..SAT), Sunday-first; Sunday header in sindoor red.
- 7 columns × 6 rows; cells ~115pt wide × ~52pt tall.
- Per-cell content (top → bottom, all from `CalendarDay` + on-tap daily compute):
  - **Day number** — large Fraunces, sindoor for Sundays, accent for primary-event days.
  - **Tithi name + until-time** — `Krishna Panchami · until 10:17 AM` ; `↑` arrow if the tithi extends past next sunrise.
  - **Nakshatra name** — small NotoSerifDevanagari muted.
  - **Yoga name** — same treatment.
  - **Sunrise + sunset times** — JetBrainsMono mini icons, single line.
  - **Rahu kalam window** — JetBrainsMono with skull-marker icon, single line.
  - **Festival pip** — small dot + abbreviated name when present (uses existing `eventDotColor` palette from [`src/components/panchang/calendarColors.ts`](src/components/panchang/calendarColors.ts)).
- Today's cell: yellow ring + filled day-number badge.
- Selected cell: sindoor outline.
- Out-of-month cells: dimmed.
- Tap cell → returns to portrait Panchang tab with `selectedDate` set (cross-route state via Zustand or route param).

**Entry point:** small "expand" icon in the existing Panchang tab's month strip (next to the layout-toggle button), routes to `/calendar-detail`.

**Data layer:** reuse existing `getCalendarMonth()`. The cell content extension (sunrise / sunset / Rahu kalam per cell) requires the daily compute — not the instant snapshot. Two options:
- **(a) On-demand per-cell daily fetch** — fires `getDailyPanchang` for each visible cell on mount. 42 × ~5ms = ~210ms blocking. Acceptable as a one-shot cost on a route the user has explicitly entered.
- **(b) Background batch with skeleton** — render cells with day# + tithi (sync from `CalendarDay`) immediately, then progressively fill in sunrise/sunset/Rahu kalam as the daily computes complete (chunked to 4–8 per `runAfterInteractions` tick).

Pick (b) — keeps initial paint snappy, and progressive fill on a 6-row grid reads as "loading detail" not "broken cells".

### Step P10.2 — Aspects view in Astrology tab (~1–2 hours) ⏳

**Why:** `bundle.aspects: AspectMap` is already returned by `computeKundli` and currently unused in the UI. Aspects (Drishti) describe how planets influence other houses beyond the one they sit in: all planets aspect the 7th from themselves; Mars also aspects 4th + 8th; Jupiter also 5th + 9th; Saturn also 3rd + 10th. Surfacing this is standard Vedic chart-reading depth — competitors all show it.

**File:** add to existing [`app/(tabs)/astrology.tsx`](app/(tabs)/astrology.tsx) as a new expandable section below the existing chart + dasha + dosha cards. No new route.

**Layout:**
- Section header "Aspects (Drishti)" / "दृष्टि" via `SectionLabel`.
- One row per graha (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu).
- Each row:
  - Graha icon (existing `<GrahaIcon>` per planet).
  - "From {{rashi}} (House {{n}})" subtitle.
  - "Aspects: {{house list}}" — comma-separated aspected house numbers, with the planets sitting in those houses chip-listed underneath.
- Collapsible default-closed (uses existing `AccordionSection` from [`src/components/panchang/AccordionSection.tsx`](src/components/panchang/AccordionSection.tsx) — reuse, don't duplicate).

**Localisation:** house numbers are numeric (digits via `useLocaleFormatters`), graha + rashi names via existing `localizeRashi` / planet localisation maps.

### Step P10.3 — Mantra Counter (P4.3 lifted) ⏳

**Same scope as the originally-scoped P4.3 in the previous Phase 4 grouping:**

**Content dependency:** mantra text + transliteration + meaning is consumed from the `hindu-devotional-texts` package. Initial 6 presets: Om Namah Shivaya, Om Namo Narayanaya, Gayatri, Maha Mrityunjaya, Hare Krishna mahamantra, Om Gan Ganapataye Namah. App calls `getMantra(slug)` / `getAllMantras()`; do not duplicate mantra text in the app.

**Implementation:**
- New route: `app/jaap.tsx`.
- Large tappable circle in center; each tap = +1 with `expo-haptics` `Selection`.
- Configurable mala size (108 default, 27, 54, 216, 1008).
- Progress ring filling around the tap circle as user approaches mala completion.
- On completion: celebratory animation + "108 completed" toast + auto-increment mala counter.
- SQLite session table: `jaap_sessions(id, started_at, ended_at, mantra_slug, mala_count, total_count)` — gated by `PRAGMA user_version` bump (v2 → v3).
- Mantra picker: presets from the text package (Devanagari + IAST + meaning) + "Custom" text input.
- History screen with sessions by date.
- **No ads during active jaap session.** Banner OK on history screen.
- Entry point: home tab tile + settings → jaap shortcut.

### Phase 10 Exit Criteria

- Landscape calendar route renders all 6 visible months without orientation flicker on Pixel 3a; entering/leaving the route correctly toggles screen orientation.
- All festival/ekadashi/sankranti/pournami/amavasya/pradosh/eclipse markers verified against drikpanchang.com for 3 sample months in the detailed calendar.
- Aspects view renders for all 9 grahas with correct house references against a known reference chart.
- Mantra counter: 6 presets pickable, 5 mala sizes selectable, session writes to SQLite, history shows last 30 sessions.
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings.

---

## 11. Deferred — iOS widget + Phase 5

### iOS WidgetKit (originally P4.2 second half) ⏸

Android widget scaffold shipped 2026-05-06 (see §6). iOS WidgetKit extension deferred — app currently ships Android-only on Play Store; iOS launch will happen after broader app refinement. Pick up the iOS half once the app is stabilised enough to be worth a parallel App Store rollout.

### Phase 5 — Audio / booking / social (on hold)

**User directive (2026-04-12):** hold until current feature work lands. Operationally heavy, should not block competitive-parity features.

- **P5.1 Audio playback** for aarti/chalisa/mantra. Single biggest retention feature per competitor analysis. Unblocks Read Along Mode. Significant content-licensing budget. Cloudflare R2 for hosting.
- **P5.2 Puja booking / astrologer consult / e-commerce.** Sri Mandir's primary revenue driver (~$12M ARR). Requires temple partnerships, Razorpay/UPI, ops team. Don't start without an ops co-founder.
- **P5.3 Social / community / sharing / video.** Native share sheet shippable any time; community + video need infrastructure + moderation overhead.

---

## 12. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier.
- Live streaming temple darshan.
- AI chat astrologer (hallucination risk on religious content).
- Cryptocurrency / NFTs / Web3.

---

## 13. Phase Dependencies Summary

**Sequencing principle:** ship optimizations + features first, language support last.

```
Done: Phase 1 ✅ → 1.5 ✅ → 2 ✅ → 3.3 ✅ → 6 ✅ → 7.1–7.3 ✅ → 8.1 ✅ → 8.2 ✅ → 8.3 (mostly) ✅ → 9 ✅ → P4.2 (Android) ✅
                                                                                                          ↓
                                                                                       Phase 10 (this PR) — calendar + aspects + mantra
                                                                                                          ↓
                                                                                       Phase 7.4–7.6 (motion finish — when feature velocity slows)
                                                                                                          ↓
                                                                                       Phase 3 (P3.1 languages — separate PR)
                                                                                                          ↓
                                                                                       Sentry (post-rollout) + iOS widget (after iOS launch)
                                                                                                          ↓
                                                                                       Phase 5 (on hold)
```

**Release cadence:** the user decides when to ship. Bundle multiple phases into one larger release rather than shipping each phase independently — the user prefers one substantive update over many small ones.
