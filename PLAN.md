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
- Stagger cap **120ms total** (post-P11.2; was 400ms); max 6 simultaneous animations per screen.
- Reduced motion respected via `useReducedMotion()` hook in every animated component.
- Haptics paired: `Selection` on state change, `Light` on confirmation. Never `Heavy`.
- Ambient loops > 2s pause off-screen.

**Compute-behind-animation rule (P11.2, durable — see `memory/feedback_animation_kept_when.md`):** an animation is kept iff (a) it runs on the UI thread without JS jank AND (b) its duration is used to mask compute (cache fetch, kundli compute, route mount, validateCandidates) OR it pairs with an action the user just took (haptic, press, toggle). Cut only if neither holds. Decorative-only animations are OK only if they're *free* — never if they delay content the user is asking for. Concretely: schedule masking animations with Reanimated's native-side primitives (`entering={FadeIn…}`, layout animations, gestures) so they start at mount without waiting for a post-commit `useEffect` to schedule the worklet on a busy JS thread. `ScreenMount` is the canonical example.

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
- **Phase 10 — Aspects + Mantra Counter** ✅ (2026-05-08). P10.3 Mantra Counter (jaap routes + 21 mantras + history; SQLite `jaap_sessions`, user_version 2 → 3) and P10.2 Aspects view (Drishti card inside Kundli, default-closed AccordionSection, surfaces existing `bundle.aspects`). P10.1 (landscape calendar) dropped, not deferred.

---

## 7. Pending — Sentry post-launch ⏳

Add `@sentry/react-native` + `sentry-expo` config plugin (decision 2026-05-02). Free Developer plan (5K errors/mo, 50 replays, 30-day retention) is sufficient at current scale; revisit only if usage actually overflows.

Setup: install plugin, register DSN, set `SENTRY_AUTH_TOKEN` as EAS Build secret so source maps + Hermes bytecode maps upload at build time, wrap root in `Sentry.wrap()`. Ship as a patch — no UI surface change.

Half-day of work. **Deferred until staged rollout reaches 100%** — Play Vitals covers the launch window.

---

## 8. Pending — Phase 7 finishing — subsumed into Phase 11 (2026-05-08)

P7.1–P7.3 shipped (see §6). Remaining sub-phases reorganized:

- **P7.4 Screen-level transitions → P11.6** — lifted with compute-masking framing (panchang date crossfade, swipe gesture, muhurat detail fade, god hero fade). The transition's duration becomes the budget for the new-context compute.
- **P7.5 Signature moments → dropped** — mandala drift = continuous animation with no compute window (battery cost on low-end Android), DeityAvatar Pranam = 700ms with nothing to mask. Both contradict the compute-behind-animation principle. Not deferred — out of scope.
- **P7.6 Pixel 3a perf gate → P11.5** — full thresholds + artifact specced inside Phase 11.

Phase 7 conventions in §4 (UI thread / transform+opacity / 220ms / reduced-motion / haptics) remain forward-applicable. Phase 11 adds: animations must mask compute or be free; never delay content the user is asking for.

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

## 10. Phase 10 — Aspects + Mantra Counter ✅ (2026-05-08)

**Why now:** Following the Phase 9 panchang densification (see §6), two high-impact features remain that pair well into a single release: a planetary aspects (Drishti) view that finally surfaces `bundle.aspects` data, and the long-pending mantra counter (originally P4.3). Both are app-internal, no native modules, no platform asymmetry.

**Removed from this phase (2026-05-08):** Landscape detailed calendar route was originally P10.1. Dropped per user — the dense Panchang grid (Phase 9) is sufficient for the almanac-page use case, and the orientation-lock complexity (`expo-screen-orientation`, portrait→landscape→portrait flicker, "Auto-rotate off" handling) wasn't worth the marginal info density gain over the existing in-tab densified grid. Not deferred — out of scope.

### Step P10.2 — Aspects view in Astrology tab ✅ 2026-05-08

Shipped: `AspectsCard` collapsible inside `KundliSection` (default-closed via `AccordionSection`, after the Shadbala block). One row per graha (Sun..Ketu) with the GRAHA_ABBR text label, "From {{rashi}} (House {{n}})" subtitle (`localizeRashi` + `useLocaleFormatters` for Devanagari digits when the language is Hindi), `aspects[graha]` rendered as a comma-separated mono house list, and a "Sits with" chip strip listing every other planet that occupies an aspected house (`{GRAHA_ABBR} · {house}` per chip). Empty `sitsWith` collapses gracefully — chips block hides instead of printing a placeholder. Aspect data comes straight from `bundle.aspects: AspectMap` (already returned by `computeKundli`); no recompute. `aspects.*` i18n namespace added to en + hi (4 keys).

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

### Step P10.3 — Mantra Counter (P4.3 lifted) ✅ 2026-05-08

**Content dependency:** mantra text + transliteration + meaning is consumed from the `hindu-devotional-texts` package. The 0.2.0 release expanded the original 6-mantra plan to 21 mantras spanning the full deity roster (Om Namah Shivaya, Om Namo Narayanaya, Gayatri, Maha Mrityunjaya, Hare Krishna mahamantra, Om Gan Ganapataye Namah, Hanuman, Lakshmi, Rama Taraka, Durga, Saraswati, Parvati, Kali, Surya Gayatri, Brahma, Sai Ram, Santoshi, Sita, Khatu Shyam, Vaishno Devi, Narasimha). App calls `getMantra(slug)` / `getAllAppMantras()` (filtered to roster) — content lives in the package, not the app.

**Shipped:**
- Routes: `app/jaap/index.tsx` (picker), `app/jaap/[slug].tsx` (counter), `app/jaap/history.tsx`.
- Picker groups mantras into "Universal" (Gayatri, Mahamrityunjaya) + deity-tagged sections; expandable Custom-mantra card; lifetime stats card (only when there's history) routes to history.
- Counter: whole-screen tap zone (mantra at top stays visible during chanting; the entire body below the header is the tap target — chips and ±buttons capture their own taps via the standard responder chain). Reanimated SVG progress ring (UI-thread `useAnimatedProps` strokeDashoffset), `expo-haptics` `impactAsync(Heavy)` on each tap (revised up from Selection then Medium after user feedback that vibration was too weak), Success notification haptic + 800ms accent flash on mala completion.
- Adaptive mantra typography: 22pt Devanagari for 1–2 line mantras (most), 19pt for 3-line, 17pt for 4-line (Gayatri); IAST scales 13 → 11pt similarly. Body height budgeted against worst case (Gayatri + IAST + chips + bottom bar) on a Pixel 3a (~590dp). Ring is 180dp.
- Mala size selector: 27 / 54 / 108 / 216 / 1008 chips; mid-session size change prompts to discard count.
- Decrement (-1) underflows into the previous mala; Reset asks before clearing.
- SQLite `jaap_sessions(id, started_at, ended_at, mantra_slug, mantra_label, mala_size, mala_count, total_count)` with `idx_jaap_sessions_started_at` for the history query — gated by `PRAGMA user_version` bump v2 → v3.
- Save flow: hardware/UI back prompts "Save this session?" when count > 0; checkmark in nav saves immediately. `mantra_label` snapshots the title at write time so custom mantras persist intact.
- History screen: last 30 sessions grouped by date (newest first); each row shows time, mantra label, total count, mala count, mala size, duration; per-row delete with confirmation; empty state with CTA.
- **No ads on the counter screen.** AdBanner kept on history (banner OK there per plan).
- Entry points: Home tab QuickRow (replaced "Search" tile, lotus glyph) + Settings → Deities section row.
- i18n: full `jaap.*` namespace in en + hi (~50 keys).

**Schema notes:** Uses an autoincrementing `id` and stores `mantra_label` text at insert time so the history list never has to re-resolve via `getMantra()` — this means renamed package slugs won't break old rows.

**Post-ship iteration (2026-05-08):** First counter draft used a ScrollView with the mantra above the counter — user reported the mantra scrolled out of view during tapping, and the Selection-strength haptic was too weak to feel. Redesigned to (a) drop the ScrollView and pin the mantra at the top of a whole-screen Pressable tap zone so reading + tapping happen on the same surface, (b) bump haptic to `impactAsync(Heavy)` for unmistakable per-tap feedback, (c) enlarge mantra typography with adaptive sizing per line count and shrink the ring 240 → 180dp to give the mantra clear visual primacy.

### Phase 10 Exit Criteria ✅

- Aspects view renders for all 9 grahas with correct house references against a known reference chart. ✅
- Mantra counter: presets pickable from package, 5 mala sizes selectable, session writes to SQLite, history shows last 30 sessions. ✅
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings. ✅

---

## 11. Phase 11 — Lean Pass: cleanup + low-end perf ⏳

**Why now (2026-05-08):** App has accumulated 10 phases of feature work. User reports the **Panchang screen takes ~1s on cold open** (instant once warm), and wants the codebase trimmed for low-end Android (Pixel 3a target). High-priority polish phase — no new features, just cleanup + perf.

**Animation principle (Phase 11 convention, durable):** Animations are kept if (a) they run on UI thread without JS jank AND (b) the animation duration is used to mask compute. Cut only if neither holds. Decorative-only animations are OK if they're free; never if they delay content the user is asking for.

### P11.1 — Panchang cold-start fix ⏳ (highest user-perceived win)

**Symptom:** First open of Panchang tab after cold-start takes ~1s. Subsequent opens instant. Day 2 cold-start re-pays the full cost (today's date is new each day).

**Suspected stack** (needs profiling to confirm — do not fix what isn't broken):
1. SQLite cache miss on today's date → first compute + first DB write.
2. First Reanimated UI thread spin-up (~50–100ms one-time).
3. `PanchangScreen` first paint — multiple `AccordionSection` mounts (Pancha Anga / Sun & Moon / Auspicious / Inauspicious / Eclipse / Time Quality / For You / Planetary), each measuring even if collapsed.
4. First Devanagari glyph paint + layout reflow.
5. Zustand SQLite-kv hydration tail.

**Plan:**
- **Pre-warm cache during splash → first-paint window**: in [`app/_layout.tsx`](app/_layout.tsx) after splash hide, fire `getCachedPanchangDay()` for today + user's lat/lon as fire-and-forget. By the time user taps Panchang tab from Home, Pass 1 cache is warm.
- **Same on app foreground (`AppState` change)** if last warm > 6 hours ago.
- **Lazy-mount accordion bodies**: confirm `AccordionSection` only renders header until expanded; if not, defer body subtree.
- **Skeleton on first paint, fade in real data** as Pass 1 lands (the compute-behind-animation pattern applied here).
- **Persist tomorrow's panchang from today**: at end-of-session or alongside reminder scheduling, precompute tomorrow's row and write to SQLite. Day 2 cold-start lands hot.

**Target:** cold-start Panchang from ~1s to ≤250ms perceived.

**First action:** profile the cold path on Pixel 3a (or release build on emulator) with `console.time` markers at SQLite open, panchang-ts call, AccordionSection mount counts, first paint. Confirm the dominant contributor before patching.

### P11.2 — Compute-behind-animation pattern + decorative-stagger removal ✅

Audit ran across every `useSharedValue` / `withTiming` / `useAnimatedStyle` / `Animated.View` / `useEntranceStagger` / `ScreenMount` site in `src/` + `app/`.

**Cuts shipped:**
- `STAGGER_CAP_MS` 400 → 120 in [`src/config/motion.ts`](src/config/motion.ts). `useEntranceStagger` and `useRefrainHighlight` consume the new cap; aarti / chalisa verse cascades and refrain settle are now bounded under 120ms regardless of `VERSE_STAGGER_MAX`.
- `ScreenMount` rewritten ([`src/components/common/ScreenMount.tsx`](src/components/common/ScreenMount.tsx)) on Reanimated's `entering={FadeIn.duration(durations.base)}` layout-animation primitive. Native-side scheduled at mount, no longer dependent on a post-commit `useEffect` that gets queued behind cold-start compute. The 220ms fade now actually masks the screen's mount-time compute window. `useAnimatedMount` deleted (only consumer was `ScreenMount`).

**Keeps (audit verified):**
- `FavoriteHeart` pulse / `MotionPressable` press / `SegmentedChip` color+scale — paired with user action.
- `SkeletonCrossfade` + `SkeletonBlock` shimmer — masks load.
- Mantra counter ring (`useAnimatedProps`) + tap scale + completion flash — masks tap feedback compute.
- `useRefrainHighlight` — fires once per reader instance, doesn't delay content (only changes refrain emphasis post-stagger).
- `CornerBrackets` draw-in, `SectionLabel` settle — one-shot worklets, do not delay content.
- `AccordionSection` chevron rotation — paired with toggle.
- Aarti / chalisa scroll-driven hero parallax — gesture-bound only.
- `WalkthroughOverlay` spotlight pulse — overlay attention cue, runs only during walkthrough.

**Documented:** §4 Phase 7 conventions extended with the compute-behind-animation rule + pointer to `memory/feedback_animation_kept_when.md`.

### P11.3 — State surface + memoization ⏳

- [`src/components/kundli/KundliSection.tsx:47-61`](src/components/kundli/KundliSection.tsx#L47-L61) — collapse 16 individual Zustand selectors into one `useShallow()` selector. Single re-render instead of 16 on theme/language toggle.
- DashaSection rows ([`src/components/astrology/DashaSection.tsx`](src/components/astrology/DashaSection.tsx)) — add `React.memo` to row/leaf components (currently re-render on parent state churn).
- Slice the panchang state — instead of holding full `IPanchangDay` in `usePanchang` ([`src/hooks/usePanchang.ts`](src/hooks/usePanchang.ts)), store only the fields a screen reads. Cuts memory pressure on Pixel 3a.
- Fix unmemoed `computeShadbalaCached` call ([`src/components/kundli/KundliSection.tsx:247`](src/components/kundli/KundliSection.tsx#L247)) — currently fires on every parent render.
- Sweep inline style arrays/object literals in hot paths (KundliSection chip strip lines 285–308).

### P11.4 — Dependency + asset trim ⏳

- **Drop `@expo-google-fonts/jetbrains-mono`** — only used for kickers/timestamps; system mono on Android renders identically. Update typeScale to fall back.
- **`assets/dharmagya_logo.png` (144 KB) → SVG component or webp.** Same for `dharmagya_logo_small.png` (60 KB).
- **Sweep unused i18n keys** in [`src/i18n/locales/en.ts`](src/i18n/locales/en.ts) + [`hi.ts`](src/i18n/locales/hi.ts) (grown organically through 10 phases).
- **Sweep unused glyphs** in custom Icon component ([`src/components/common/Icon.tsx`](src/components/common/Icon.tsx)) — verify all 60 glyphs are still referenced.
- **Audit `package.json`** for any dep that's no longer imported anywhere.

### P11.5 — Pixel 3a perf gate (replaces P7.6) ⏳

**Device matrix:** Pixel 3a (Android 12, 4GB) is the gate. Samsung A14 secondary. Pixel 7 / iPhone reference only.

**Profile per screen** with RN Performance Monitor + Hermes CPU sampling on the most-impactful interactions: cold-start Home → Panchang tab tap, reader open, tab switch, panchang date change, deity grid scroll, god detail entry.

**Acceptance thresholds:**
- Cold-start Home → Panchang tab tap → first paint of real data ≤ 350ms.
- UI FPS ≥ 58 avg, ≥ 55 p95 during animation on Pixel 3a.
- JS FPS ≥ 55 avg.
- No single dropped-frame event > 50ms.
- Cold-start to tab-bar-visible unchanged from pre-Phase-11 baseline ± 50ms.
- Memory: full 5-tab traversal does not exceed pre-P11 baseline by > 5MB.

**Regression rule:** offending animation/component is **removed**, not "optimized later." Frame rate is essential.

**Reduced-motion E2E:** toggle Android "Remove animations" → every animation collapses to instant. Recorded on device video.

**Battery:** any continuous animation gets 30-min foreground drain delta vs pre-P11 baseline ≤ 2%.

**Artifact:** `perf-baseline.md` with per-screen FPS + memory + cold-start + reduced-motion verification + battery delta. Checked into repo as the shipping gate.

### P11.6 — Custom screen transitions with compute-masking (lifts P7.4) ⏳

Reanimated v4.1.1 + gesture-handler v2.28 already installed. Today they're used for **in-screen** animation only — screen-to-screen transitions are still default `expo-router` / `react-native-screens`. Make transitions richer + functional:

- **Panchang date change** ([`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx)) — content area `opacity 1→0` (140ms), kick off `getCachedPanchangDay()` for new date during the fade-out, new content `opacity 0→1 + translateY 4→0` (220ms) when ready. Skeleton fallback if compute exceeds 350ms. Calendar cells reuse P7.2 chip interpolation. Haptic `Selection` on cell tap.
- **Panchang horizontal swipe** — pan-gesture day change. Commit if `|dx| > 80px` OR `|v| > 400px/s`; spring back otherwise. Worklet via `useAnimatedGestureHandler`. `activeOffsetX` so vertical scroll wins on scrollable bodies.
- **Custom `expo-router` screen options** per route — modal slide-up for sub-screens like Settings → Birth Place; fade for content swaps. Configure via `<Stack.Screen options={{ animation, presentation }} />`.
- **Muhurat occasion → detail** ([`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx)) — title + icon fade in over 220ms after route mount. Compute (validateCandidates if needed) fires during the fade.
- **God detail hero image fade** — hero photo `opacity 0→1` over 320ms once loaded. Deity-gradient scrim at full opacity underneath.

**Skip:** `react-native-shared-element` — crashes on Android + Fabric in RN 0.81 (existing PLAN.md note retained).

**Exit:** date changes feel cohesive (no flash); swipe doesn't hijack vertical scroll; 60fps holds during rapid date navigation on Pixel 3a; transitions actually mask compute (skeleton fallback rarely visible on warm cache).

### Phase 11 Exit Criteria

- ⏳ Panchang cold-start ≤ 250ms perceived (from current ~1s).
- ⏳ Decorative stagger removed; compute-behind-animation pattern documented in §4.
- ⏳ KundliSection + DashaSection + panchang state surface trimmed; no measurable re-render regressions on theme/language toggle.
- ⏳ JetBrainsMono dropped, logo PNGs optimized, i18n + Icon glyph sweeps complete.
- ⏳ Pixel 3a perf gate passed; `perf-baseline.md` checked in.
- ⏳ P7.4 transitions shipped as P11.6 with compute-masking.
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings.

---

## 12. Deferred — iOS widget + Phase 5

### iOS WidgetKit (originally P4.2 second half) ⏸

Android widget scaffold shipped 2026-05-06 (see §6). iOS WidgetKit extension deferred — app currently ships Android-only on Play Store; iOS launch will happen after broader app refinement. Pick up the iOS half once the app is stabilised enough to be worth a parallel App Store rollout.

### Phase 5 — Audio / booking / social (on hold)

**User directive (2026-04-12):** hold until current feature work lands. Operationally heavy, should not block competitive-parity features.

- **P5.1 Audio playback** for aarti/chalisa/mantra. Single biggest retention feature per competitor analysis. Unblocks Read Along Mode. Significant content-licensing budget. Cloudflare R2 for hosting.
- **P5.2 Puja booking / astrologer consult / e-commerce.** Sri Mandir's primary revenue driver (~$12M ARR). Requires temple partnerships, Razorpay/UPI, ops team. Don't start without an ops co-founder.
- **P5.3 Social / community / sharing / video.** Native share sheet shippable any time; community + video need infrastructure + moderation overhead.

---

## 13. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier.
- Live streaming temple darshan.
- AI chat astrologer (hallucination risk on religious content).
- Cryptocurrency / NFTs / Web3.
- Landscape detailed calendar route (originally P10.1, dropped 2026-05-08). Densified Panchang grid from Phase 9 covers the almanac-page use case; not worth the orientation-lock complexity.

---

## 14. Phase Dependencies Summary

**Sequencing principle:** ship optimizations + features first, language support last.

```
Done: Phase 1 ✅ → 1.5 ✅ → 2 ✅ → 3.3 ✅ → 6 ✅ → 7.1–7.3 ✅ → 8.1 ✅ → 8.2 ✅ → 8.3 (mostly) ✅ → 9 ✅ → P4.2 (Android) ✅ → Phase 10 ✅
                                                                                                                              ↓
                                                                                                  Phase 11 (Lean Pass — high priority NEXT)
                                                                                                                              ↓
                                                                                                  Phase 3 (P3.1 languages — separate PR)
                                                                                                                              ↓
                                                                                                  Sentry (post-rollout) + iOS widget (after iOS launch)
                                                                                                                              ↓
                                                                                                  Phase 5 (on hold)
```

**Release cadence:** the user decides when to ship. Bundle multiple phases into one larger release rather than shipping each phase independently — the user prefers one substantive update over many small ones.
