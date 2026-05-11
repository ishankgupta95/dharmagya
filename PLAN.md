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

Use the modern synchronous API. Do NOT use the legacy `expo-sqlite/legacy` or `SQLite.openDatabase()`. The DB is wrapped via `<SQLiteProvider databaseName="dharmsetu.db" useSuspense>` in `app/_layout.tsx`; tables are managed in [`src/utils/database.ts`](src/utils/database.ts) on `onInit` and gated by `PRAGMA user_version`. Currently at version 5 (post-Phase 13 — `muhurat_cache` rows wiped to backfill `score` + `reasons` from `MuhuratMatch`).

**Current schema:** `muhurat_cache(occasion, lat_key, lon_key, matches_json, scanned_through, updated_at)` — 365-day rolling muhurat scan cache; `matches_json` carries `MuhuratMatch[]` including the 4.1-era `score: 0..100` and `reasons: string[]` from `scoreMuhurta`. Also: `jaap_sessions` (counter history), `custom_mantras` (user-typed presets). New tables for future features cache through this surface, not a separate persistence layer.

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

## 11. Phase 11 — Lean Pass: cleanup + low-end perf ✅ (2026-05-10)

**Why now (2026-05-08):** App has accumulated 10 phases of feature work. User reports the **Panchang screen takes ~1s on cold open** (instant once warm), and wants the codebase trimmed for low-end Android (Pixel 3a target). High-priority polish phase — no new features, just cleanup + perf.

**Animation principle (Phase 11 convention, durable):** Animations are kept if (a) they run on UI thread without JS jank AND (b) the animation duration is used to mask compute. Cut only if neither holds. Decorative-only animations are OK if they're free; never if they delay content the user is asking for.

### P11.1 — Panchang cold-start fix ✅ (resolved organically 2026-05-10)

Original symptom: first open of Panchang tab after cold-start took ~1s. Resolved without the planned cache-prewarm / tomorrow-precompute work — the upstream cuts in P11.2 (`STAGGER_CAP_MS` 400→120, `ScreenMount` on native-side FadeIn), P11.3 (`useShallow` collapsing 16 store subscriptions in `KundliSection`, `React.memo` on Dasha rows, dead `usePanchang.ts` deleted), and P11.4 (JetBrainsMono dropped, logo→webp, 46 i18n keys + 4 deps trimmed) collectively closed the gap. User-verified on device: Panchang tab cold-open is no longer slow.

If a regression resurfaces in the future, the original plan above remains the playbook: profile first (`console.time` at SQLite open, panchang-ts call, AccordionSection mount counts, first paint), then layer the splash-window prewarm + tomorrow-precompute on top.

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

### P11.5 — Pixel 3a perf gate ✅ (informal verification 2026-05-10)

Closed without the formal `perf-baseline.md` artifact. Device-verification on user's hardware confirmed Panchang cold-start is no longer slow (the explicit P11.1 symptom that motivated the gate) and no other screen has surfaced perf regressions through Phases 9–12. **If a regression appears post-launch, the original thresholds above (≤350ms first paint / ≥58 FPS UI / ≤5MB memory delta) become the diagnostic target — re-spec a perf pass at that point.**

### P11.6 — Custom screen transitions with compute-masking (lifts P7.4) ⏳

Reanimated v4.1.1 + gesture-handler v2.28 already installed. Today they're used for **in-screen** animation only — screen-to-screen transitions are still default `expo-router` / `react-native-screens`. Make transitions richer + functional:

- **Panchang date change** ([`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx)) — content area `opacity 1→0` (140ms), kick off `getCachedPanchangDay()` for new date during the fade-out, new content `opacity 0→1 + translateY 4→0` (220ms) when ready. Skeleton fallback if compute exceeds 350ms. Calendar cells reuse P7.2 chip interpolation. Haptic `Selection` on cell tap.
- **Panchang horizontal swipe** — pan-gesture day change. Commit if `|dx| > 80px` OR `|v| > 400px/s`; spring back otherwise. Worklet via `useAnimatedGestureHandler`. `activeOffsetX` so vertical scroll wins on scrollable bodies.
- **Custom `expo-router` screen options** per route — modal slide-up for sub-screens like Settings → Birth Place; fade for content swaps. Configure via `<Stack.Screen options={{ animation, presentation }} />`.
- **Muhurat occasion → detail** ([`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx)) — title + icon fade in over 220ms after route mount. Compute (validateCandidates if needed) fires during the fade.
- **God detail hero image fade** — hero photo `opacity 0→1` over 320ms once loaded. Deity-gradient scrim at full opacity underneath.

**Skip:** `react-native-shared-element` — crashes on Android + Fabric in RN 0.81 (existing PLAN.md note retained).

**Exit:** date changes feel cohesive (no flash); swipe doesn't hijack vertical scroll; 60fps holds during rapid date navigation on Pixel 3a; transitions actually mask compute (skeleton fallback rarely visible on warm cache).

### Phase 11 Exit Criteria ✅ (closed 2026-05-10)

- ✅ Panchang cold-start no longer slow (resolved organically by P11.2/3/4 work; user-verified on device).
- ✅ Decorative stagger removed; compute-behind-animation pattern documented in §4.
- ✅ KundliSection + DashaSection + panchang state surface trimmed; no measurable re-render regressions on theme/language toggle.
- ✅ JetBrainsMono dropped, logo PNGs optimized, i18n + Icon glyph sweeps complete.
- ✅ Pixel 3a perf gate informally verified (formal `perf-baseline.md` artifact dropped — see P11.5 above).
- ✅ P7.4 transitions shipped as P11.6 with compute-masking.
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings.

---

## 12. Phase 12 — panchang-ts 4.0.0 surface ✅ (2026-05-10)

**Why (2026-05-10):** panchang-ts 4.0.0 published with **14 new compute APIs** spanning advanced Jyotish (yogas, karakas, ashtakavarga, bhava bala, varshaphala, tithi pravesha, arudhas, argala, upagrahas, special lagnas, pathu porutham, narayan dasha, KP layer, prashna). All additive — every 3.1.0 export is preserved. One minor breaking-change-by-typing: `result.abhijitMuhurta` is now nullable (null on Wednesdays, Drik convention). Patched at the single call site.

**Phasing principle:** keep each sub-phase shippable on its own; defer technical/niche features to later sub-phases or post-launch.

### P12.1 — Yogas + Karakas + Ashtakavarga (Tier A — high value, in-place additions to Kundli) ⏳

Three additive surfaces inside the existing Kundli view; no new routes.

- **Yogas** — `computeYogas(d1, { navamsa: d9 })`. Render named classical yogas (Pancha Mahapurusha / Gajakesari / Raja / Dhana / etc.) as a default-open accordion. Each row: `name · type` + `reasons[]`. Empty-state copy when nothing matches.
- **Jaimini Karakas** — `computeJaiminiKarakas(d1)`. 7-row list (Atmakaraka → Darakaraka). Compact card, no accordion.
- **Ashtakavarga** — `computeAshtakavarga(d1)`. 12-cell heat-grid; segmented chip switches between Sarvashtaka (sum, 0..56) and per-graha Bhinnashtaka. Default-collapsed accordion (math-heavy).

**Cache:** all three are pure functions of `d1` (Yogas + Ashtakavarga also accept `d9`); add LRU keyed on `inputKey(inp)` matching the existing `KUNDLI_CACHE` pattern.

**Strings:** Yoga names (`'Gajakesari'`) and Karaka names (`'Atmakaraka'`) are intentionally not locale-resolved by the library — render as-is in both languages, matching the existing convention for nakshatra-derived proper nouns.

### P12.2 — Bhava Bala + Pathu Porutham (Tier B — paired surface upgrades) ✅ (2026-05-10)

- **Bhava Bala** — `computeBhavaBalaCached(inputs)` added next to `computeShadbalaCached` (LRU on `inputKey`). New `BhavaBalaChart` component renders 12 stacked bars (Bhavadhipati / Dik / Drishti / Sthana) sized to each bhava's `total`, normalised against the strongest bhava in the chart. Slotted between Shadbala and Yogas in `KundliSection.tsx`.
- **Pathu Porutham** — `matchPathuPorutham(boy, girl)` added next to `matchAshtakoot`. Result screen now has a 36-point / 10-fold segmented toggle (default Ashtakoot). Veto-failed koots get a sindoor outline so the user reads which koot flipped the recommendation. Both systems consume the same boy/girl role assignment so no extra inputs are needed.

### P12.3 — Varshaphala annual chart + Tithi Pravesha (Tier B — new screen) ✅ (2026-05-10)

Shipped:
- New route `app/kundli/varshaphala.tsx` with shared shell — system toggle (`SOLAR · VARSHAPHALA` / `SOLI-LUNAR · TITHI PRAVESHA`, default Varshaphala), 1-indexed yearAge picker (default = `Math.floor((now − birth) / 365.25636d)`), and one body per mode.
- **Varshaphala body** — Varsha Lagna + Year Lord (with Shadbala basis) + solar-return-instant timestamp inside one NightCard. Muntha card (rashi · lord · house) with a per-age advancement hint. 27-Saham accordion (`storageKey="kundli.varshaphala.sahams"`, **default-collapsed** mirroring Ashtakavarga, `rightHint="27"`); each row = `name kicker · rashi · longitude° · house chip`.
- **Tithi Pravesha body** — Pravesha lagna NightCard with the natal tithi (`Shukla / Krishna {{n}}`) reproduced from `praveshTithi`. North/South chart toggle reusing existing `NorthChart` / `SouthChart` via a new `cellsFromLagnaPlanets(lagnaRashi, planets, lang)` adapter in `chartCells.ts`. Bhava cusps strip (12 rows: house · rashi · °) under the configured house system. Planets-at-pravesha card (graha abbr · name · rashi · house).
- Service: `computeVarshaphalaCached(inp, yearAge)` + `computeTithiPraveshaCached(inp, yearAge)` in `kundliService.ts`, both with LRU(4) keyed on `inputKey | v{age}` / `| tp{age}` — outside `KundliBundle` since they're time-shifted recomputes.
- Entry point: card in `KundliSection.tsx` between MatchOthers and Your Details — kicker `ANNUAL CHART`, calendar icon, `router.push('/kundli/varshaphala')`. Not folded into the existing accordion stack since this is its own route.
- `kundli.openVarshaphala*` / `kundli.varshaphala.*` / `kundli.tithiPravesha.*` namespaces added to en + hi (~30 keys); proper-noun terms (Saham names, Year Lord planet, Muntha lord) stay un-localized per library convention.
- ScreenMount + SafeAreaView edges `['top','bottom']` per non-tab convention.

### P12.4 — Sensitive points sweep ✅ (2026-05-10)

Shipped: single "Advanced Points" `AccordionSection` (`storageKey="kundli.advancedPoints"`) slotted between Aspects and the Compatibility CTAs in `KundliSection.tsx`, default-collapsed. Inside the accordion, four sub-surfaces stacked:
- **Arudhas** — 12 padas (AL/A2..A12), `bundle.arudhas` ride-along; AL highlighted with `palette.goldLeaf` / `palette.sindoor` per theme.
- **Argala** — `bundle.argala` ride-along; per-bhava badge + two `ChipStrip`s (argala / virodhargala) of GRAHA_ABBR chips.
- **Upagrahas** — `computeUpagrahasCached(inp)` (LRU 8 on inputKey, gated on accordion open). 7 rows: name · localized rashi · longitude° · house badge.
- **Special lagnas** — `computeSpecialLagnasCached(inp)` returns `{ hora, ghati, bhava, sripati }` (LRU 8); 4-row table with un-localized lagna kind labels per the proper-noun convention.

Pure-D1 helpers ride along inside `KundliBundle`; time-and-location-dependent ones (Upagrahas + special lagnas) live outside as their own `*Cached` entries with the established LRU pattern. Lazy compute — both Cached calls are gated by the accordion's `open` flag in `KundliSection.tsx` so cold open of the Kundli view doesn't pay 11 lib calls.

### P12.5 — KP layer + Narayan Dasha + Prashna chart ✅ (2026-05-10)

Three independent surfaces, landed bundled in one PR (Phase 12 close-out):

1. **Narayan Dasha** — `computeNarayanCached(inp)` in `kundliService.ts` (LRU 8 mirroring `computeCharaCached`). `DashaSystem` union extended with `'narayan'`; 5th chip in the system-toggle strip; `NarayanTimeline` body in `DashaSection.tsx` reusing the Chara MahaDasha row layout, with the `direction: 'forward' | 'backward'` flag surfaced in the current-card subtitle. New i18n: `dasha.system.narayan`, `dasha.narayan.directionForward/Backward`, `dasha.narayanFullCycle` (en + hi).

2. **KP layer** — `KpCard` accordion slot (`storageKey="kundli.kp"`) below "Advanced Points", default-collapsed. Two sub-sections: cuspal sub-lords table (12 rows: house · cusp degree · sign-lord · star-lord · sub-lord, all GRAHA_ABBR) + per-graha significators list (4-fold rule). `computeKpCuspalSubLordsCached(inp)` (LRU 8, lazy on accordion open) — the lib forces Placidus-KP cusps internally regardless of `inp.houseSystem`, harmless. `bundle.kpSignificators` rides along (pure-d1). Inline ayanamsa note tells the user KP is canonical under Krishnamurti ayanamsa; we don't force-switch it (global Settings preference). New i18n: `kundli.kp.*` namespace (en + hi).

3. **Prashna chart** — new route `app/kundli/prashna.tsx` with the same shell as varshaphala (header back pill + ScreenMount + SafeAreaView edges `['top','bottom']`). Form: query date + time pickers (default = now) + location field that defaults to `userLocation` (canonical Prashna anchor — "where the question is asked from"), falling back to `userBirthPlace` so users without GPS aren't dead-ended. "Cast Prashna" CTA triggers `computePrashnaChartCached({ timestamp, location, ayanamsa, language, houseSystem })` (LRU 4 on the prashna-specific key). Result body: NightCard with prashna lagna (rashi + degree + nakshatra/pada) → North/South chart toggle reusing `cellsFromLagnaPlanets` → bhava cusps strip (12 rows under the configured house system) → planets-at-query card (GRAHA_ABBR + retrograde flag + house badge). Entry point: a second card in `KundliSection.tsx` directly below the Varshaphala CTA, kicker `PRASHNA · QUERY CHART`, compass icon. New i18n: `kundli.prashna.*` + `kundli.openPrashna*` (en + hi).

Service-layer additions (all in `kundliService.ts`): bundle now also rides along `arudhas`, `argala`, `kpSignificators`. New cached entries: `computeUpagrahasCached`, `computeSpecialLagnasCached`, `computeNarayanCached`, `computeKpCuspalSubLordsCached`, `computePrashnaChartCached`. `SpecialLagnas` and `PrashnaInputs` types exported.

`KundliSection.tsx` final section order: chart → doshas → dignity → strength (Shadbala + Bhava Bala) → yogas → karakas → ashtakavarga → aspects → **advanced points → kp** → compatibility → varshaphala CTA → **prashna CTA** → your details.

### Phase 12 Exit Criteria ✅

- ✅ P12.1 Yogas + Karakas + Ashtakavarga shipped in Kundli view.
- ✅ P12.2 Bhava Bala + Pathu Porutham shipped (2026-05-10).
- ✅ P12.3 Varshaphala / Tithi Pravesha shipped on dedicated `/kundli/varshaphala` route (2026-05-10).
- ✅ P12.4 sensitive-points sweep shipped (2026-05-10).
- ✅ P12.5 KP / Narayan / Prashna shipped (2026-05-10).
- `tsc --noEmit` clean throughout; `npx expo lint` holds at the 8-warning baseline.

---

## 13. Phase 13 — panchang-ts 4.1.0 surface ✅ (2026-05-11)

**Why (2026-05-11):** panchang-ts 4.1.0 published. Mostly result-shift bug fixes (Mangal Dosha now also checks Mars from Venus; Pitru Dosha rewritten on a 9-rule classical catalog; Neecha Bhanga more permissive with 5 rules; Shadbala combust-check fix) — all rendered automatically because the affected cards (`DoshaCard`, `YogasCard`) read library-supplied reasons/strings rather than re-deriving them. One **breaking** change: Shadbala's `bala.<Graha>.sthana` range extends from 0–60 V to 0–420 V, and `bala.<Graha>.total` shifts up by +30 to +150 V per graha. The `ShadbalaChart` already renders bars as a percentage of the strongest graha in the same chart, so the visualisation is invariant under the new range; only the absolute number after the bar grows (JSDoc updated to flag the new range).

### Shipped surface additions (all four opt-ins from the release notes)

1. **`yoga.bhanga`** — `YogasCard.tsx`. The optional `bhanga: { applies: boolean; reasons: string[] }` field on Pancha Mahapurusha + Gajakesari is now rendered: when `applies` is true the row gets a `CANCELLED` tag, the name strikes through, the bullet flips to sindoor, and a "Cancelled by:" sub-block lists the bhanga reasons under the positive ones. Existing yogas without a catalog bhanga rule (Raja, Lakshmi, Dhana, etc.) render unchanged.

2. **Ashtakoot Bhakoot enrichment** — `match.tsx` + `useBirthStore.ts`. `natalMoonFromChart(d1, navamsa)` now fills the optional `lagnaRashi` (ascendant) and `navamsaRashi` (Moon's D9 rashi) fields per the 4.1 `NatalMoon` extension. When both natives carry them, `computeAshtakoot` enables three extra Bhakoot cancellations (same lagna-lord, same 7th-lord, same Navamsa-lord). `BirthChartEntry.derived` extended with `navamsaRashi?: number`; old cached entries without the field force a recompute on next access so the opt-in fires. `match.tsx` reads partner navamsa from the freshly-computed kundli + persists it back. The existing cancellations strip in the result view picks the new entries up automatically — no UI rework.

3. **8-Jaimini Karaka variant** — `KarakasCard.tsx`. New segmented toggle (`7 · PARASHARA` / `8 · JAIMINI`); default stays on the 7-Parashara variant so historical readers see the same table. Switching to the 8-variant adds the Pitrukaraka (father) row at position 5 and includes Rahu by descending reversed degree. `KundliBundle.karakas8: Jaimini8Karakas` is pre-computed in `computeKundli` (pure D1 walk, microseconds) so the toggle is purely cosmetic. New i18n keys: `kundli.karakas.variant7/8`, `kundli.karakas.roles.Pitrukaraka`.

4. **Sripati cusps + Trikonargala** — `AdvancedPointsCard.tsx` + `kundliService.ts`. `computeSripatiLagna` now called with `{ includeCusps: true }` so `SpecialLagnas.sripati` carries the 12 bhava-madhya longitudes; a new `SRIPATI CUSPS · 12 BHAVA MADHYAS` sub-section in the advanced-points accordion renders one row per bhava (rashi name + degree-in-rashi). `computeArgala` now called with `{ includeTrikonargala: true }` so each `ArgalaPerBhava` carries the optional `trikona` field with `sources` (5th from bhava) and `virodhakas` (9th from bhava, Ketu reversed); when present, two extra `ChipStrip`s render under the primary 2/4/11 vs 3/10/12 split. Both compute on the existing cached path, no new LRU entries.

### Result-shift APIs (re-verified, no code changes needed)

- **Mangal Dosha** — `DoshaCard.tsx` already reads `mangal.fromVenus.house` / `.afflicted` since the field is in the type. The new Venus-axis flagging surfaces as additional reasons under the existing 3-chart card.
- **Pitru Dosha** — `DoshaCard.tsx` renders `pitru.reasons[]` verbatim; the 9-rule catalog rewrites the reason list but the rendering loop is unchanged.
- **Kaal Sarp** — unchanged.
- **Neecha Bhanga** — not explicitly surfaced in our UI; it flows through `computeYogas`' yoga list as a named yoga and rides along the existing rendering.
- **Shadbala combust-fix** — value changes invisible to the user because of the per-chart normalisation in `ShadbalaChart`.

### Service-layer summary

`kundliService.ts`:
- New type imports: `Jaimini8Karakas`, `SripatiLagnaInfo`.
- `KundliBundle.karakas8: Jaimini8Karakas` added (rides along, pure-D1).
- `KundliBundle.argala` now carries Trikonargala via `{ includeTrikonargala: true }` to `computeArgala`.
- `SpecialLagnas.sripati: SripatiLagnaInfo` (with 12 cusps) via `{ includeCusps: true }` to `computeSripatiLagna`.
- `natalMoonFromChart(chart, navamsa?)` returns the enriched `NatalMoon` with `lagnaRashi` + optional `navamsaRashi`.

### P13b — Mangal severity + muhurat scores ✅ (2026-05-11)

Surfaced two already-existing library fields that the UI had been ignoring (both available pre-4.1 in the lib's type surface; 4.1 was the natural moment to expose them alongside the new opt-ins).

**Mangal Dosha severity + cancellation prominence** — `DoshaCard.tsx`. The Mangal row now branches on `mangal.severity: 'none' | 'anshik' | 'purna'` instead of just `afflicted: boolean`:
- `severity: 'none'` → green check, "Not Manglik".
- `afflicted: true` (no cancellation) → sindoor alert, "Anshik Manglik · Partial" or "Purna Manglik · Full".
- `severity !== 'none'` && `afflicted: false` (cancelled) → amber info icon, severity label with a `CANCELLED` pill tag and a prominent inline callout listing the cancellation reasons (`mangal.cancellations[]`). This is the case the old UI hid in a tiny italic footnote — readers couldn't tell "you're technically partial-manglik but neutralized by Mars-Jupiter conjunction" without squinting.

New i18n: `kundli.mangal.severity.{none,anshik,purna}`, `kundli.mangal.cancelledTag`, `kundli.mangal.cancelledBy`. Old `mangalAfflicted` / `mangalNotAfflicted` keys removed (replaced by the severity nesting).

**Muhurat score badges + reasons** — `muhurat.ts` + `[occasion].tsx`. `MuhuratMatch` now carries `score: number` (0..100) and `reasons: string[]` from `scoreMuhurta`, persisted through the SQLite `muhurat_cache`. `user_version` bumped 4 → 5 and `muhurat_cache` wiped once on upgrade so every row backfills with the new fields.

Each DayRow renders a band-colored score pill between the day-info column and the chevron (font: display-italic 18pt over a tinted background, suffixed with the localized "/ 100"). Bands: 90+ goldLeaf (`Highly auspicious`), 70+ gold (`Auspicious`), 50+ amber (`Mildly auspicious`), <50 sindoor (`Marginally auspicious`). The expanded detail leads with a "Why this day" block — band label + localized score + bullet list of reasons (`tithi · purnima · auspicious tithi`, etc.) — above the existing Best Slots / Rahu Kalam sections. Accessibility label now includes `"Score X out of 100"`.

New i18n: `muhurat.scoreKicker`, `muhurat.scoreOutOf`, `muhurat.scoreAccessibility`, `muhurat.whyThisDay`, `muhurat.scoreBand.{excellent,good,mild,marginal}`. Hindi versions use Devanagari numerals via `useLocaleFormatters().formatNumber`.

### Phase 13 Exit Criteria ✅

- ✅ Package bumped to ^4.1.0.
- ✅ All four new opt-ins surfaced (yoga.bhanga, Bhakoot enrichment, 8-Jaimini variant, Sripati cusps + Trikonargala).
- ✅ Mangal Dosha severity (Anshik/Purna) + cancellation prominence surfaced; old binary afflicted UI replaced.
- ✅ Muhurat scores + reasons surfaced on every DayRow + expanded detail; SQLite cache bumped to v5.
- ✅ Shadbala value-range breaking-change documented; visualization unaffected by the per-chart normalisation.
- ✅ `tsc --noEmit` clean; `npx expo lint` holds at the 8-warning baseline.

---

## 14. Deferred — iOS widget + Phase 5

### iOS WidgetKit (originally P4.2 second half) ⏸

Android widget scaffold shipped 2026-05-06 (see §6). iOS WidgetKit extension deferred — app currently ships Android-only on Play Store; iOS launch will happen after broader app refinement. Pick up the iOS half once the app is stabilised enough to be worth a parallel App Store rollout.

### Phase 5 — Audio / booking / social (on hold)

**User directive (2026-04-12):** hold until current feature work lands. Operationally heavy, should not block competitive-parity features.

- **P5.1 Audio playback** for aarti/chalisa/mantra. Single biggest retention feature per competitor analysis. Unblocks Read Along Mode. Significant content-licensing budget. Cloudflare R2 for hosting.
- **P5.2 Puja booking / astrologer consult / e-commerce.** Sri Mandir's primary revenue driver (~$12M ARR). Requires temple partnerships, Razorpay/UPI, ops team. Don't start without an ops co-founder.
- **P5.3 Social / community / sharing / video.** Native share sheet shippable any time; community + video need infrastructure + moderation overhead.

---

## 15. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier.
- Live streaming temple darshan.
- AI chat astrologer (hallucination risk on religious content).
- Cryptocurrency / NFTs / Web3.
- Landscape detailed calendar route (originally P10.1, dropped 2026-05-08). Densified Panchang grid from Phase 9 covers the almanac-page use case; not worth the orientation-lock complexity.

---

## 16. Phase Dependencies Summary

**Sequencing principle:** ship optimizations + features first, language support last.

```
Done: Phase 1 ✅ → 1.5 ✅ → 2 ✅ → 3.3 ✅ → 6 ✅ → 7.1–7.3 ✅ → 8.1 ✅ → 8.2 ✅ → 8.3 (mostly) ✅ → 9 ✅ → P4.2 (Android) ✅ → Phase 10 ✅ → Phase 11 ✅ → Phase 12 ✅ → Phase 13 ✅
                                                                                                                                                                          ↓
                                                                                                                                        Bundled release (next ship)
                                                                                                                                                                          ↓
                                                                                                                                        Phase 3 (P3.1 languages — separate PR)
                                                                                                                                                                          ↓
                                                                                                                                        Sentry (post-rollout) + iOS widget (after iOS launch)
                                                                                                                                                                          ↓
                                                                                                                                        Phase 5 (on hold)
```

**Release cadence:** the user decides when to ship. Bundle multiple phases into one larger release rather than shipping each phase independently — the user prefers one substantive update over many small ones.
