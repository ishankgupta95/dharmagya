# SYSTEM CONTEXT: Hindu Devotional App (dharmSetu / MVP Phase)

> **Note:** Done phases are summarized in §6. Full sub-phase decisions live in `memory/project_*.md` files and git history. Pending work is in §7 onward, ordered by priority — **optimizations + features first, language support last.**

## 1. Project Objective

You are an expert React Native developer building a daily Hindu devotional app. The app must be highly performant, fully offline-capable for text data, use on-device mathematical calculations for astrological calendar data, and be heavily optimized for cross-platform support.

## 2. Current State & Tech Stack

- Current State: You are working inside an ALREADY INITIALIZED Expo project (SDK 56, RN 0.85.3, React 19.2.3, TypeScript 6.0 — upgraded 2026-05-22, see `memory/project_sdk_56_upgrade_landed.md`). Do NOT run `npx create-expo-app` or wipe the root directory.
- Framework: Expo (with New Architecture and React Compiler enabled).
- Navigation: `expo-router` (File-based routing). Use expo-router `<Tabs>` for all tab navigation — do NOT use react-native-paper's BottomNavigation.
- State Management: Zustand (for preferences, favorites, and theme toggling).
- Panchang Engine: `panchang-ts`. Source of truth for tithi/nakshatra/yoga/karana/muhurat/kundli/dasha/dosha.
- Location Services: `expo-location` (To feed coordinates into the Panchang engine).
- Local Database: `expo-sqlite` — currently used for the muhurat scan cache (`muhurat_cache` table) and (future) the Jaap session table. Aartis/chalisas come from the `hindu-devotional-texts` package at runtime. Favorites + preferences live in Zustand (persisted via `expo-sqlite/kv-store`).
- UI Library: `react-native-paper` (Material Design 3 — for UI components like Cards, Buttons, Surfaces only).
- Animations: `react-native-reanimated` v4.3.1 + `react-native-worklets` v0.8.3 + `react-native-gesture-handler` v2.31 (already installed; do NOT reinstall).
- Typography (post-P6.9.1): `@expo-google-fonts/fraunces` (display serif), `@expo-google-fonts/noto-serif-devanagari` (Devanāgarī body). **Mukta and JetBrainsMono are removed**; do not reinstall.
- Icons (post-P6.9.2): custom `<Icon>` component in `src/components/common/Icon.tsx` (react-native-svg). `@expo/vector-icons` is no longer a direct dep.
- Backend: **none** — the app is fully offline; all user data is local (SQLite + Zustand-on-kv-store). Phase 15 (§9) would add the first backend.
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

Pure TypeScript, no native modules, RN-compatible. Wraps as `getPanchangam`, `computeKundli`, `computeAshtakoot`, `computeMangalDosha`, `computeKaalSarp`, `computePitruDosha`, `computeSadeSati`, `computeShadbala`, `computeDignity`, `computeVimshottariDashaFromBirth`, `computeAshtottariDasha`, `computeYoginiDasha`, `computeCharaDasha`, `computeDivisionalChart`, `scoreMuhurta`, plus the 4.0/4.1-era advanced surface (`computeYogas`, `computeJaiminiKarakas`, `computeAshtakavarga`, `computeBhavaBala`, `computeVarshaphala`, `computeTithiPravesha`, `computeUpagrahas`, `computeSpecialLagnas`, `computeArgala`, `matchPathuPorutham`, `computeNarayanDasha`, KP + Prashna helpers), etc. Library handles ayanamsa, house system, varga math; consumers cache via LRU keyed on input hash. See [`src/services/astrology/`](src/services/astrology/) for the existing wrapper pattern.

**Timezone handling:** birth times are wallclock-in-birthplace-tz. Always pass through [`src/utils/time.ts`](src/utils/time.ts) `wallclockInZoneToUtc` before handing to library — `new Date('YYYY-MM-DDTHH:mm:00')` parses in device tz, which breaks any user travelling outside India.

**Performance:** ~5–20ms per kundli compute. LRU caches keep re-renders cheap.

**`abhijitMuhurta` is nullable** (null on Wednesdays, Drik convention) since panchang-ts 4.0.0.

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

**Typography:** Fraunces (display serif + italic), Noto Serif Devanagari (Devanāgarī body, 400/500/700). Mono caps + numeric fall back to the platform mono font (JetBrainsMono dropped in P11.4).

**Spacing:** 24px screen horizontal padding; 16–20px card internal padding; 16–20px vertical card gap; 12–14px grid gap; tab bar 10px top / `Math.max(insets.bottom, 10)` bottom.

**Phase 6 conventions (forward-applicable):**
- Theme-responsive surfaces use `colors.surface` / `colors.surfaceRecessed` / `colors.border` / `colors.text*` / `colors.accent` / `colors.emphasis`. Hardcoded palette only in the four exceptions above.
- Alpha-tinted alert banners: `color + '1E'` (bg) / `+ '66'` (border) / full-color foreground.
- Plain screen names, not decorative kickers (per `feedback_no_decorative_taglines.md`).
- No new deities (per `feedback_content_accuracy_audit.md`); the existing roster is fixed — new content (weekday deities, puja vidhi, Navadurga forms) maps onto existing roster entries, it does not add Library deities. (Roster size: **19** — see `src/config/deities.ts` / the `Deity` type in `hindu-devotional-texts`. The content-audit memory's "26" was an over-count; the real, authoritative number is 19. A day's deity that isn't in the roster — Shani Dev, Murugan/Kartikeya, Brihaspati on the Vaar Devata pages — is named as text only: no avatar, no `/god/[id]` page.)
- SafeAreaView edges: non-tab screens `['top','bottom']`; tab screens `['top']`.
- Post-task gate: `tsc --noEmit` clean + `npx expo lint` ≤ 8 warnings.

**Phase 7 conventions (forward-applicable):**
- Transform + opacity only — never `width`/`height`/`borderRadius`/raw `color`.
- Worklets always (`react-native-reanimated` 4.1). Never the legacy `Animated` API or `setInterval`-driven animation.
- 220ms default duration, `Easing.out(Easing.cubic)`. Max 320ms for interaction feedback.
- Stagger cap **120ms total** (post-P11.2; was 400ms); max 6 simultaneous animations per screen.
- Reduced motion respected via `useReducedMotion()` hook in every animated component.
- Haptics paired: `Selection` on state change, `Light` on confirmation. Never `Heavy` — except the Mantra Counter per-tap `impactAsync(Heavy)` (deliberate, after user feedback that lighter haptics weren't felt).
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
| 15 | Kundli sub-routes      | `app/kundli/varshaphala.tsx`, `app/kundli/prashna.tsx` |
| 16 | Jaap                   | `app/jaap/index.tsx`, `app/jaap/[slug].tsx`, `app/jaap/history.tsx` |
| 17 | Onboarding             | `app/onboarding/*` (3 steps + walkthrough) |
| 18 | Location Permission    | `app/location-permission.tsx`  |

**Removed:** `app/rashifal/`, standalone `app/dasha.tsx` (folded into Astrology tab). (`app/katha/` was originally removed; **restored 2026-05-19** when the vrat-katha feature was surfaced from `hindu-devotional-texts` 0.3.0 — see `memory/project_katha_feature_landed.md`.)

**Added (Phase 14):** `app/vaar/[day].tsx` — Vaar Devata detail screen (P14.1, shipped). `src/components/share/*` + `src/store/useShareSheet.ts` — shareable-card host (P14.5, shipped; off-screen renderer, no route). `app/navratri/{index,vrat,kanya-pujan}.tsx` + `app/scripture/[id].tsx` — Navratri 9-day guide + vrat-rules + Kanya Pujan + Saptashati outline (P14.3, shipped). **`app/puja/{index,[slug]}.tsx`** — Puja Vidhi listing + detail (P14.2, shipped). **`app/(tabs)/practice.tsx`** + **`app/(tabs)/settings.tsx`** — dedicated 5th Practice tab + Settings as a top-level tab (P14.3 / bottom-nav restructure).

**Added (post-Phase 14, 2026-05-19):** `app/katha/{index,[slug]}.tsx` — Vrat Katha reader (Satyanarayan + 5 vrat kathas from `hindu-devotional-texts` 0.3.0). Bhagavad Gita + Sundarkand readers added 2026-05-22 via `hindu-devotional-texts` 0.4.0.

---

## 6. Shipped phases — summary

All phase decisions and per-sub-phase notes live in `memory/project_*.md`. **Everything below is in production as of 2026-05-28** (`app.json` at version 1.9.1 / versionCode 13, SQLite at `user_version` 6, Expo SDK 56, RN 0.85.3).

- **Phase 1 — MVP** ✅. All 17 steps shipped (initial release).
- **Phase 1.5 — Follow-ups** ✅ except: Read-Along Mode (deferred — tied to P5.1 audio), Expo Go reminder verification (needs dev build, not Expo Go).
- **Phase 2 — Daily habit drivers** ✅ partial. P2B reminders + P2C muhurats shipped. P2A vrat katha and P2D rashifal removed (tables dropped on init; do not revive without fresh design — see git log).
- **Phase 3.3 — Isht Devata personalization** ✅ (2026-04-13). Home re-ranking, "Your Deities" strip, Search re-ranking, Settings → Manage Your Deities.
- **Phase 6 — Sacred Editorial redesign** ✅ (2026-04-20). All 10 sub-phases. Mukta + Ionicons fully dropped; theme tokens drive everything.
- **Phase 7.1–7.3 — Motion foundation + system micro-interactions + editorial reveals** ✅ (2026-04-22). Motion tokens, FavoriteHeart, SegmentedChip, ScreenMount, verse stagger, refrain highlight, CornerBrackets draw-in. (P7.4 screen transitions → shipped as P11.6; P7.6 perf gate → P11.5; P7.5 signature moments dropped — out of scope, continuous animation with no compute window.)
- **Phase 8.1 — panchang-ts v2.4 surface** ✅ (2026-05-01). Tarabala, Varjyam, Ganda Mula, Madhyahna, Sandhya, Do Ghati, ayanamsa setting, Chandra Balam, Adhika Masa, instant snapshot, eclipses, GRAHA_ABBR chip, PanchangError diagnostics.
- **Phase 8.2 — Kundli + Matching + Sade Sati** ✅ (1.7.0, 2026-05-06). Astrology tab, North + South charts, D1 + D9, doshas (Mangal + Kaal Sarp + Pitru), Ashtakoot match with saved-charts store, Sade Sati banner, chart style + house system selectors, True Chitra + Thirukanitham ayanamsas.
- **Phase 8.3 — divisional charts + dashas + library-backed muhurat** ✅ (1.7.0, 2026-05-06). Divisional D2–D30, four dasha systems (Vimshottari/Ashtottari/Yogini/Chara), Shadbala chart, library-backed muhurat (custom RULES dropped, `scoreMuhurta` is source of truth), bundled-candidate fast path, instant-cache render. panchang-ts 3.1.0 surface wired up alongside (Kaal Sarp + Pitru doshas, Shadbala, D2–D30, Ashtottari/Yogini/Chara).
- **1.7.0 Play Store launch** ✅. Screenshots, AAB, staged rollout. Bug fixes flagged 2026-05-06 all resolved (muhurat low-end perf, walkthrough off-screen clamp, screenshots).
- **Phase 9 — Panchang Densification** ✅ (2026-05-06 → 2026-05-07). Fullscreen-calendar route reversed; instead the Panchang tab was densified into a "Sacred Almanac" ledger. Shipped: layout toggle (compact ↔ dense transposed grid) persisted in Zustand, lazy `useLazyDailyPanchang` hook (daily compute deferred until first accordion expand), category accordions (Pancha Anga / Sun & Moon / Auspicious / Inauspicious / Eclipse / Time Quality / For You / Planetary), glance section reading from `CalendarDay` snapshot only, Pancha Anga "Sacred Almanac entry" redesign (italic Fraunces kickers; auto static/dynamic limb modes), full Hi localisation in dense cells, default-open Pancha Anga, store v12/v13 migrations. Yearly drilldown lists (Ekadashi / Sankranti / Upcoming Eclipses) in [`src/services/astrology/calendarService.ts`](src/services/astrology/calendarService.ts).
- **P4.2 — Today's Panchang widget (Android scaffold)** ✅ (2026-05-06). Android-only AppWidgetProvider drop with system fonts + dark register + foreground+tap-refresh. **iOS WidgetKit deferred** (see §11).
- **Phase 10 — Aspects + Mantra Counter** ✅ (2026-05-08). Drishti card inside Kundli (surfaces `bundle.aspects`, default-closed accordion, row-per-graha + "sits with" chips). Mantra Counter — `app/jaap/*` routes (picker / whole-screen-tap counter with Reanimated SVG progress ring / last-30 history); 21 mantras + custom presets from `hindu-devotional-texts`; mala sizes 27–1008; SQLite `jaap_sessions`, `user_version` 2→3; `custom_mantras` table; entry from Home QuickRow + Settings. P10.1 landscape calendar dropped (out of scope). Notes: `memory/project_p10_2_landed.md`, `project_p10_3_landed.md`, `project_jaap_mantra_polish_2026_05_08.md`.
- **Phase 11 — Lean Pass (cleanup + low-end perf)** ✅ (2026-05-08 → 2026-05-10). Panchang cold-start fixed (resolved organically by the cuts below — user-verified on device). Compute-behind-animation rule adopted (§4): `STAGGER_CAP_MS` 400→120, `ScreenMount` rebuilt on native-side `FadeIn` layout animation. State-surface trim: `useShallow` collapsing 16 selectors in `KundliSection`, `React.memo` on Dasha rows, dead `usePanchang.ts` deleted. Dependency/asset trim: JetBrainsMono dropped, logo PNGs → webp, 46 i18n keys + 5 Icon glyphs + 4 deps removed. Custom screen transitions (P11.6, lifts P7.4): panchang date crossfade + horizontal swipe gesture, modal-up settings sub-screens, fade for search, god hero photo fade. P11.5 perf gate closed informally (no `perf-baseline.md` artifact; thresholds ≤350ms first paint / ≥58 FPS / ≤5MB delta become the diagnostic target if a regression surfaces). Notes: `memory/project_p11_{2,3,4,6}_landed.md`, `project_phase11_closed.md`.
- **Phase 12 — panchang-ts 4.0.0 surface** ✅ (2026-05-10). 14 new compute APIs surfaced. In Kundli view: Yogas accordion (named classical yogas + reasons), Jaimini Karakas card, Ashtakavarga heat-grid (Sarva/Bhinna toggle), Bhava Bala 12-bar chart, Advanced Points accordion (Arudhas + Argala + Upagrahas + special lagnas, lazy-computed on open), KP cuspal sub-lords + significators card, Narayan dasha (5th system chip). In match: Pathu Porutham 36-point / 10-fold toggle alongside Ashtakoot. New routes: `/kundli/varshaphala` (Varshaphala annual chart + Tithi Pravesha, system + 1-indexed age toggle, 27-Saham accordion, N/S chart toggle via `cellsFromLagnaPlanets`) and `/kundli/prashna` (query date/time/location form, casts a Prashna chart). Cached entries (LRU) for all time-shifted recomputes; pure-D1 helpers ride along `KundliBundle`. Notes: `memory/project_p12_{1,2,3,4,5}_landed.md`.
- **Phase 13 — panchang-ts 4.1.0 / 4.1.1 surface** ✅ (2026-05-11). Four opt-ins surfaced: `yoga.bhanga` cancellation tags (strikethrough + "Cancelled by" sub-block); Ashtakoot Bhakoot enrichment via enriched `NatalMoon` (`lagnaRashi` + `navamsaRashi` → 3 extra cancellations), `BirthChartEntry.derived.navamsaRashi` added with forced recompute on old cache rows; 8-Jaimini Karaka variant toggle (default stays 7-Parashara); Sripati cusps + Trikonargala in Advanced Points. Mangal Dosha severity (`none`/`anshik`/`purna`) + cancellation prominence replaces the old binary "afflicted" UI. Muhurat score pills (0..100, banded goldLeaf/gold/amber/sindoor) + "Why this day" reasons on every DayRow + expanded detail; `muhurat_cache` wiped, `user_version` 4→5. Shadbala value-range change (sthana 0–420 V, total +30..+150 V) is invisible to the per-chart-normalised `ShadbalaChart`. Patch-bumped 4.1.0 → 4.1.1 (type-check clean, no surface change). Notes: `memory/project_p13_landed.md`, `project_panchang_ts_4_1_1_landed.md`.
- **Bundled production release — Phases 10–13 + Jaap polish** ✅ (2026-05-12). Everything in the codebase through panchang-ts 4.1.1 shipped to production. Note: `memory/project_phase10_13_in_production.md`.
- **Phase 14 — Devotional Practice & Engagement (P14.1–P14.6)** ✅. All six sub-phases shipped to production in the post-2026-05-12 bundle. P14.1 Vaar Devata + P14.2 Puja Vidhi + P14.3 Navratri guide (with the 5th "Practice" bottom tab + Settings tab) + P14.4 Sadhana streaks + milestone celebrations (SQLite `user_version` 5→6) + P14.5 shareable cards + P14.6 audit-driven content fixes (4 critical + 8 significant + 6 minor — see `memory/project_p14_6_landed.md`). Mantras still carry `reviewPending: true` pending the Sanskrit-reviewer pass (see §7 below).
- **Katha feature** ✅ (2026-05-19). `/katha/index` + `/katha/[slug]` reader surfaces Satyanarayan + 5 vrat kathas (`karva-chauth`, `vaibhav-lakshmi`, `santoshi-mata`, `solah-somvar`, `ahoi-ashtami`) from `hindu-devotional-texts` 0.3.0; Kanya Pujan re-export + `/navratri/kanya-pujan` screen linked from Navratri Day 8/9. Library content gaps (empty `about` strings, English-only katha prose) flagged upstream. Note: `memory/project_katha_feature_landed.md`.
- **Scripture readers** ✅ (2026-05-22). Bhagavad Gita + Sundarkand readers added via `hindu-devotional-texts` 0.4.0 → 0.4.1.
- **SDK 56 upgrade** ✅ (2026-05-22). Expo 54→56 (two-major hop), RN 0.81.5→0.85.3, React 19.1→19.2.3, TypeScript 5.9→6.0.3. Reanimated 4.3.1 + worklets 0.8.3. Dropped `newArchEnabled` + `android.edgeToEdgeEnabled` (now mandatory). Codemod gotcha documented (`expo-codemod` sends `BottomTabBar` imports to the wrong path — see `memory/project_sdk_56_upgrade_landed.md`). 39 lint errors are pre-existing React-19-stricter-rules surfaces, deferred.
- **Phase 14 + Katha + scripture readers + SDK 56 bundled release** ✅ (shipped via `phase_14` → `master` merge, commits through `5a9e8db`). App.json bumped to 1.9.1 / versionCode 13. Next ship boundary is clean.

---

## 7. Pending — Sanskrit-reviewer pass on mantra strings ⏳ — only Phase 14 debt remaining

A qualified-Sanskrit-reviewer pass on every mantra string Phase 14 surfaces. Single engagement, three configs:

- `src/config/vaarDevata.ts` — the 7 weekday mantras (4 of 7 already match the `hindu-devotional-texts` package verbatim; flag stays set across the board for consistency until one pass clears them all).
- `src/config/pujas.ts` — every puja's Dhyana mantra, closing kshama-prarthana, Ghatasthapana sub-step mantras, the Rudrabhishek Mahamrityunjaya, plus the two new P14.6-flagged additions (Ganesh Prāṇa-pratiṣṭhā household form + Navagraha-Stotra Sūrya opening).
- `src/config/navratri.ts` — the 9 Navadurga bīja-mantras + the 9 dhyāna shlokas.

Until the pass lands, all mantras carry `reviewPending: true` and surface a "transliteration under scholarly review — treat as provisional" caption everywhere they render. Do not flip the flag in any config without confirmation that the relevant scholar has signed off.

**Separately deferred** (not part of this debt): the full verse-by-verse Sanskrit text of the Durga Saptashati — its own ~700-verse content-review project, tracked under P14.3.

---

## 7a. Pending — Sentry post-launch ⏳

Add `@sentry/react-native` + `sentry-expo` config plugin (decision 2026-05-02). Free Developer plan (5K errors/mo, 50 replays, 30-day retention) is sufficient at current scale; revisit only if usage actually overflows.

Setup: install plugin, register DSN, set `SENTRY_AUTH_TOKEN` as EAS Build secret so source maps + Hermes bytecode maps upload at build time, wrap root in `Sentry.wrap()`. Ship as a patch — no UI surface change.

Half-day of work. **Gated on the staged rollout reaching 100%** — Play Vitals covers the launch window. Small + orthogonal; can slot in anytime after that gate clears.

---

## 8. Shipped — Phase 14 — Devotional Practice & Engagement ✅ — retained for reference

**Why (2026-05-12, researched against Sri Mandir / Drik Panchang / AstroSage·AstroTalk + content & technical sources):** Five user-requested features that deepen daily engagement and close competitive gaps — three new devotional-content surfaces (weekday deity worship, puja procedures, a Navratri guide) and two retention/virality mechanics (practice streaks, shareable cards). All are app-internal — no backend, no native modules beyond `react-native-view-shot` / `expo-sharing` / `expo-media-library` for P14.5. Sri Mandir is the only competitor with developed gamification + share-everywhere in this space; nobody offers an interactive guided puja or a panchang-computed Navratri guide — those are genuine gaps. Suggested order within the phase: P14.1 → P14.5 → P14.4 → P14.3 (before its seasonal deadline) → P14.2 (highest effort/risk).

**Content-accuracy posture (P14.1–P14.3, hard):** the no-new-deities roster constraint holds (§4). Devotional content (puja steps, mantras, vrat rules, Navadurga details) is sourced from the consumed text package + cross-checked against authoritative references (Drik Panchang's per-deity vidhi pages, Sanskrit Documents Archive for mantra text, scriptural sources for Navadurga iconography), and gets a qualified-reviewer pass before shipping — web sources gave transliterations, not authoritative editions. Where traditions genuinely diverge, the UI states the variation rather than silently picking one. Frame procedures as "a standard home practice," not as any sampradaya's authoritative rite; carry source attribution + a "regional/family variations exist; a pandit's guidance supersedes this app for major ceremonies" disclaimer on puja content.

### P14.1 — Vaar Devata (weekday deity worship) ✅ (2026-05-12 — mantra reviewer-pass still pending)

A daily contextual surface answering "which deities today, and what to do." Each weekday is named for a graha and carries one or more deities + practices. Data + bilingual text live in [`src/config/vaarDevata.ts`](src/config/vaarDevata.ts) (mirrors `festivalNames.ts`); chrome in `vaar.*` i18n. Verified day→deity table (cross-checked across Drik Panchang's Saptavara Vrat list, 99Pandit, AstroVed, pujayagna.com, venupayyanur.com):

| Day (graha) | Deities — **all equal weight, none "primary"** | Color | Top offerings | Weekday mantra | Variant / practice notes |
| --- | --- | --- | --- | --- | --- |
| Sun · Ravivar (Surya) | Surya | Red/orange | Red flowers, wheat, jaggery, water arghya at sunrise | `Om Suryaya Namah` | Bhairava Ravivara Vrat (Shaiva tradition) |
| Mon · Somvar (Chandra) | Shiva · Parvati | White | Bel patra, cold milk, panchamrit, white sweets | `Om Namah Shivaya` | Solah Somvar (16 Mondays); Shravan Somvar |
| Tue · Mangalvar (Mangal) | Hanuman *(North India)* · Murugan/Kartikeya *(South India / Tamil Nadu)* | Red | Sindoor, mustard-oil diya, boondi/ladoo, bananas | `Om Ham Hanumate Namah` | Mangala Gauri Vrat (Shravan Tuesdays) |
| Wed · Budhvar (Budh) | Ganesha · Vitthal/Krishna *(Maharashtra)* | Green | Durva grass, modak, banana | `Om Gan Ganapataye Namah` | Budha-graha shanti |
| Thu · Guruvar (Brihaspati) | Vishnu · Brihaspati *(the day's graha-deity)* · Sai Baba | Yellow | Chana dal + ghee, yellow sweets, tulsi | `Om Namo Bhagavate Vasudevaya` | Brihaspativar Vrat Katha. **Sai Baba is one of the day's deities at equal standing** — not a footnote, not "the Thursday deity" to the exclusion of Vishnu/Brihaspati. |
| Fri · Shukravar (Shukra) | Lakshmi/Mahalakshmi · Santoshi Mata | White/pink | Kheer, lotus, coconut | `Om Shreem Mahalakshmyai Namah` | Santoshi Mata 16-Friday vrat (no sour food); Vaibhava Lakshmi Vrat (MH/GJ) |
| Sat · Shanivar (Shani) | Shani Dev · Hanuman | Black/dark blue | Black sesame (til), sesame-oil lamp, urad dal | `Om Sham Shanaishcharaye Namah` | Maa Kali Shanivara Vrat (Shakta tradition); Peepal worship |

**Design — equal-weight deities (no per-day "major" god):** a day's `deities` list is unordered in standing; a deity may carry a neutral `context` chip ("North India", "Maharashtra", "Shakta tradition", …) saying *where / in which tradition* an association holds — never *how important*. The Home card shows the day's roster deities' avatars in a row (no single "lead" image) plus every name; the detail screen lists every deity at equal visual weight (avatar — a neutral `ॐ` monogram for the roster-absent ones — name, context chip, note, and a per-deity Library link where one exists). The per-day mantra is *the weekday mantra by tradition*, surfaced under a "mantra for the day" label — it doesn't designate any listed deity as primary.

**Surfaces (shipped):** Home card "Today's Deities" ([`TodaysDeityCard.tsx`](src/components/common/TodaysDeityCard.tsx)) → Vaar Devata detail screen ([`app/vaar/[day].tsx`](app/vaar/[day].tsx) — 7-day picker, ruling graha + colour, deities of the day, weekday mantra + one-tap "Start Jaap", offerings/bhog, fasting/vrat, variant notes, disclaimer). **Isht Devata tie-in:** if one of the day's deities is one of the user's selected deities, the home card flags "Your Isht Devata is in focus today." **Kundli-remedy tie-in** ([`RemedyNudge.tsx`](src/components/kundli/RemedyNudge.tsx)): contextual nudges keyed to the user's chart — debilitated Chandra → Monday Shiva worship (under the dignity strip); Mangal Dosha (active, uncancelled) → Hanuman on Tuesday; active Sade Sati → Shani + Hanuman on Saturday; running mahādaśā lord → its weekday — framed as "traditionally", never as a fix.

**V1 cap:** 7 days with deities / graha / color / top-3 offerings / the weekday mantra / fasting-rule summary; variants as labeled notes. Per-day Vrat Katha text deferred. **All mantra strings carry `reviewPending: true`** and the detail screen shows a "provisional — transliteration under scholarly review" caption; four of the seven match the `hindu-devotional-texts` package mantras verbatim, but the flag stays set across the board until a qualified-reviewer pass lands (that pass is the one remaining P14.1 item).

### P14.2 — Puja Vidhi (major puja procedures) ✅ (2026-05-14)

A new "Puja" content type — structured worship procedures, surfaced from the Library (pujas are deity-linked) and cross-linked from Festivals, Muhurat, Vaar Devata, and the Jaap counter.

**Reusable framework:** **Shodashopachara** — the 16-upachara sequence: Dhyana/Avahana → Asana → Padya → Arghya → Achamana → Madhuparka → Snana (plain water; Panchamrita for extended) → Vastra → Yajnopavita → Gandha → Pushpa/Archana → Dhupa → Deepa → Naivedya → Tambula → Neerajanam/Aarti, then Pradakshina + Namaskara/Kshama-prarthana to close; **Panchopachara** (Gandha/Pushpa/Dhupa/Deepa/Naivedya) as the lite path. The Sanskrit step names are stable across major sources (Brihat Tantrasara is the cited Agama basis); minor substitutions (Alankara vs Abhara, expanded Panchamrita snana) are acceptable variation. Implement the 16-step skeleton once as a template; each named puja is a parameterization (deity, snana substances, flower, bhog, mantra, stotra/katha). Surrounding liturgical arc per named puja: purification (achamana/pranayama/lamp/Ganesh-dhyana) → **Sankalpa** (gotra/name/place/tithi/nakshatra + intention — obligatory for a named puja) → Kalash puja (+ Prana Pratishtha for new idols only) → the 16 upacharas → stotra/katha (+ optional havan/purnahuti) → close → visarjana (for temporarily-installed images only; permanent home shrines do Uttapana instead).

**V1 named pujas (~7), each = a "when/why" blurb + interactive samagri checklist + numbered steps (Sanskrit name + plain-language line) + deep links (deity aarti / mantra → Jaap counter / relevant muhurat / linked festival):** Satyanarayan Katha Puja (most-performed household puja; ties to next Purnima muhurat), Lakshmi/Diwali Puja, Ganesh Puja, Rudrabhishek (ties to next Pradosh/Monday), Hanuman Puja (ties to Vaar Devata Tue/Sat), Navagraha Shanti Puja (ties to Kundli/Dosha), Navratri Ghatasthapana (ties to P14.3). **Deferred:** Vishnu Sahasranama archana, Saraswati Puja, Mahamrityunjaya jaap (partly served by the counter), Griha Pravesh (needs a priest; complex).

**P14.2b — Guided Mode (deferred):** step-by-step walkthrough screens (reuse the existing walkthrough UI pattern), auto-starting the Jaap counter at the mantra step. High differentiation; out of v1.

**Risks (highest in Phase 14):** (1) accuracy — wrong mantras/step order is a trust-killer → expert-review pass, in-app source attribution, the "variations exist / a pandit supersedes this app" disclaimer; (2) scope creep — "where's X puja" will be immediate → frame as "Featured Pujas," add a request mechanism, don't claim "complete library"; (3) regional/sampradaya variation in samagri + order → label the source tradition, flag major deviations. Drik Panchang's per-deity vidhi pages are the best structured source; cross-validate against a temple/pandit source + Sanskrit Documents Archive for mantra text.

### P14.3 — Navratri / Navadurga 9-day guide ✅ (2026-05-14)

The full nine-day Navratri practice, tied into the existing Festivals screen + panchang computation + daily notifications.

**Navadurga (verified canonical order — Wikipedia, Drik Panchang, Art of Living, JKYog all agree):** Day 1 Shailaputri → 2 Brahmacharini → 3 Chandraghanta → 4 Kushmanda → 5 Skandamata → 6 Katyayani → 7 Kalaratri → 8 Mahagauri → 9 Siddhidatri. Per day surface: form name + iconography (mount, attributes), 2–3-sentence significance, the day's mantra (`ॐ देवी <form>ायै नमः` + the dhyana shloka where available), traditional bhog/prasad (ghee → sugar/mishri → kheer → malpua → banana → honey → jaggery/gur → coconut → sesame; Day 9 also commonly halwa-puri-chana for Kanya Pujan — show both), and the color of the day. (Chakra associations Muladhara→Sahasrara are consistent across sources and safe to include.)

> **⚠️ Colors are NOT fixed per Navadurga form.** The "Yellow=Day1, Green=Day2…" lists online are a 2003 *Maharashtra Times* circulation gimmick, not tradition. Drik Panchang's authoritative system assigns colors by **the weekday Navratri starts**, then a fixed 9-color weekly cycle — so they change every year. **Compute the colors from the panchang (day-of-week on Ashwin Shukla Pratipada → weekday color cycle); never hardcode a color per goddess.** Tell the user: "Colors follow the weekday — this year Day 1 falls on <weekday>, so it's <color>."
>
> **⚠️ The Navadurga ↔ Navagraha planet mapping is fringe, not canonical.** Some astrology blogs map each form to a planet, but the mappings contradict each other across sources and Drik Panchang / Wikipedia don't carry it. If surfaced at all, label it "some astrological traditions associate…" — never as scriptural fact.

**Rituals & vidhi:** Ghatasthapana / Kalash Sthapana on Day 1 (kalash + sapta-dhanya/barley sowing + akhand jyot) with its muhurat — first one-third of the day while Pratipada prevails, or Abhijit muhurat fallback; not at night/afternoon, not within Amavasya; avoid Chitra nakshatra & Vaidhriti yoga (advised, not prohibited — **verify whether `panchang-ts` exposes Vaidhriti-yoga / Chitra-nakshatra flags for the muhurat window; surface if it does, else just compute the time window**). Daily routine: sankalpa → panchopachara/shodashopachara to the kalash + day's form → 108× the day's mantra → the day's Durga Saptashati chapter(s) (the 13 chapters map onto the 9 days — Day1: ch1; Day2: ch2–4; … Day9: ch13) → Durga aarti; akhand jyot kept lit all 9 days. **Kanya Pujan / Kanjak** on Ashtami **or** Navami (both valid; Ashtami more common in North India; West Bengal does Maha Ashtami Kumari Puja) — 9 girls aged 2–10 (optionally one boy as Bhairav), wash feet, tilak, offer halwa-puri-chana, gift clothes/money; the 9 ages have traditional names (Kumarika → Subhadra). **Durga Visarjan / Vijayadashami** on Dashami — final puja, purna ahuti, idol/kalash immersion; Dussehra in the North, Sindoor Khela / Darpan Visarjan in Bengal.

**Vrat (fasting) rules screen:** intensity tiers (Nirjala / Phalahar / partial-satvik / two-day Day1+Day9). Allowed: kuttu (buckwheat), singhara (water-chestnut), rajgira (amaranth), sama/barnyard millet, sabudana, makhana; potato/sweet-potato/yam, pumpkin/lauki/cucumber, raw banana; nuts & dry fruit; dairy (milk/curd/paneer/ghee); jaggery/honey/sugar; **sendha namak (rock salt) only**; cumin/pepper/ginger/green-chili/lemon/ajwain. Forbidden: all true grains (wheat/rice/maida/sooji/besan/corn), all dals/legumes, onion/garlic/brinjal, regular iodized salt, turmeric/hing/mustard/fenugreek/garam-masala, meat/fish/egg, alcohol/tobacco.

**The four Navratris:** Sharad/Shardiya (Ashwin, Sep–Oct) — *primary, "Maha Navratri"*; Chaitra/Vasanta (Chaitra, Mar–Apr) — second-most-observed, Hindu New Year; Magha Gupt (Magha, Jan–Feb) and Ashadha Gupt (Ashadha, Jun–Jul) — tantra/sadhana-focused, worship the **ten Mahavidyas** (not the Navadurga), kept private. All four anchor to **Shukla Pratipada → Navami** of their month — fully panchang-computable. **Build the full 9-day guide for Sharad (reuse it for Chaitra); for the two Gupt Navratris, just a calendar entry + a short informational card** (different deity set, sensitive, private practice).

**Surfaces:** Festivals screen → Navratri card with auto-computed dates + Ghatasthapana muhurat; a 9-day guide screen (day picker, current day highlighted during Navratri); daily push notifications during the 9 days (morning: day#, form, color, bhog, mantra; Day1: Ghatasthapana muhurat; Day8/9: Kanya Pujan reminder; Day9: Navami close + havan; Day10: Visarjan); the vrat-guide screen; the Durga Saptashati added to the existing chalisa/aarti reader with the 9-day chapter map. The Navadurga forms are Navratri *content*, not 9 new Library entries.

### P14.4 — Sadhana streaks + milestones (gamification) ✅ (2026-05-14)

A retention layer built on data the app already records (`jaap_sessions`), tuned for a devotional context — private milestones, no leaderboards, gentle framing.

**v1 mechanics:** (1) **Sadhana streak** — counts any calendar day with ≥1 completed jaap session; a small flame/counter under the Mantra Jaap card on Home. (2) **Cumulative mantra/mala counter** — total across all time (derivable from `jaap_sessions`), shown on the Jaap screen, with milestone acknowledgments at *sacred* numbers (108 / 1,008 / 10,800 / 108,000 mantras) — not arbitrary round ones. (3) **Session-count milestones** — 7 / 21 / 30 / 108 / 365 sessions, in-app celebration screen (not a push by default); persisted in a new `milestones_achieved` table (SQLite `user_version` bump).

**Offline handling:** store `last_active_date` (calendar-date string) + `current_streak` + `last_event_epoch`; on a qualifying action compare to `last_active_date` (same → no-op; yesterday → +1; ≥2 days → reset to 1); allow a **26-hour grace window** (not midnight-strict — kinder to night worshippers + time zones); sanity-check `now() ≥ last_event_epoch − 60s` to detect a rolled-back clock and freeze rather than silently break. Accept that a determined user can game an offline streak and that reinstall wipes it (same as Calm/Headspace) — **Phase 15 account sync is what makes a streak survive reinstall** (note the dependency).

**Cultural-sensitivity rules (hard):** no public leaderboards, ever; no user-to-user comparison; name it from tradition ("Sadhana streak" / "Nitya Abhyas" — not "Pray Streak"); a missed day resets quietly with "every day is a new beginning," never "Streak lost!"; the streak-at-risk evening notification is **opt-in only** and worded as a gentle practice reminder, not a loss threat; a streak-freeze analogue, if added later, is "Vishram Divas" (rest day). **Not in v1:** streak freeze, streak-at-risk push (beyond the existing opt-in daily reminder), festival/reading streaks, profiles.

### P14.5 — Shareable cards (WhatsApp / status images) ✅ (2026-05-12)

Render styled cards off-screen → hand them to the system share sheet: deity blessings, festival greetings, verse/mantra cards, jaap-completion cards. The biggest viral lever; Sri Mandir pushes context-aware "share this blessing" on nearly every screen (and generates name-personalized puja-completion *videos* — out of scope for us).

**Technical (verified):** `react-native-view-shot` (`captureRef`, re-exported by Expo) — current versions support the New Architecture (RN ≥ 0.76; this app is on 0.81.5, fine) — captures an off-screen `<View>` to PNG; render the card at **1080×1920** (9:16, WhatsApp Status spec; keep content in the centre ~1080×1350 safe zone) or **1080×1080** (1:1, better for chat); share via `expo-sharing` `shareAsync` (system sheet) + offer `expo-media-library` `saveToLibraryAsync` ("Save to Gallery" — many users curate then post separately). **Reality check:** there is **no API to post directly to WhatsApp Status** — the user always taps "My status" inside WhatsApp after the share sheet; `whatsapp://send?text=` deep-links can't attach an image. Skip `react-native-share` (WhatsApp-direct) in v1 — New-Architecture support unverified; the system sheet is enough.

**v1 card types:** (1) **festival greeting** — one template per major festival (deity image + festival name in Devanagari + English + app watermark; "Share greeting" on the Festivals screen; ties to P14.3 for Navratri); (2) **deity blessing** — 1:1, deity image + name + one signature mantra/verse; "Share" on the deity detail screen; (3) **verse/mantra card** — from the aarti/chalisa reader, "Share this verse" on any verse with "From <text name>" attribution; from the Jaap counter, a post-session "I completed 108 repetitions of <mantra> today" card. Reuse the app's fonts (NotoSerifDevanagari / Fraunces). **Content/rights:** deity images are existing licensed assets; watermark cards with the app name (small, lower corner) — identifies the source, makes no authenticity claim. Chalisa/aarti/mantra text is classical/public-domain; share one or two lines (not a whole chalisa) with a source label. **Not in v1:** name-personalized greetings (needs a name-input form), video status cards (Skia/ffmpeg — much bigger), WhatsApp-direct sharing.

### P14.6 — Audit-driven content + accuracy fixes ✅ (2026-05-16, shipped to production in the Phase-14 bundle)

**Why (2026-05-14, audit on `phase_14`):** A full audit of the bundled-pending Phase 14 surfaced **four critical content errors**, **eight significant concerns**, and **one implementation gap** that go beyond the existing mantra-reviewer debt. Unlike the mantras (which carry `reviewPending: true` and surface a "provisional" caption everywhere they render), these items are **not flagged in the UI**, so a user reading them takes them as authoritative — every wrong fact is a trust hit. P14.6 is the cleanup pass that closes the audit before the bundle ships. Independent of, and in parallel with, the still-pending Sanskrit-reviewer mantra pass (the existing combined open item).

**Scope:** content + one notification-scheduler edit. **No new screens, no schema changes, no new deities, no new package dependencies.** All edits to existing `src/config/*.ts` files plus one `src/services/reminderScheduler.ts` change. ~1–2 hours of focused work for someone with the audit punch list in hand.

**Critical (must fix before bundled release):**

1. **`src/config/pujas.ts:1262, 1273` — Hanuman Chalisa meter error.** "40 dohas" / "forty-doha hymn" → "40 chaupais (framed by 3 dohas)" / "forty-chaupai hymn". Tulsidas wrote *cālīsā* in chaupai meter, not doha. Hindi readers will catch it.
2. **`src/config/navratri.ts:715-716` — Besan miscategorised as a grain.** Besan (chickpea flour) is a legume flour, not a grain. Move from the "All grains" line to the "All dals/legumes" line. The forbidden ruling itself is correct; only the categorisation is wrong.
3. **`src/config/navratri.ts:719` — Turmeric/hing rule too strict.** Currently lists both as universally forbidden; in fact regional practice (Maharashtra/Gujarat/Bengal) commonly permits a pinch. Either reword the line with a `(strict tradition only)` caveat or add a screen-level variant note. Decision: lean strict (Smarta-North-Indian) but disclose the variation.
4. **`src/services/reminderScheduler.ts:256-260` — 11th Navratri push notification missing.** Plan §8 P14.3 says 11; only 10 are scheduled (Days 1–9 + Day 10). Decide: schedule a Day-1 Ghatasthapana muhurat reminder (~30 min before muhurat start) as the 11th, or update the plan + closure to reflect the deliberate 10-only schedule.

**Significant (resolve or document deferral):**

5. **`src/config/navratri.ts:351-356, 378-383` — Chakra ascent discontinuity.** Day 7 → Day 8 currently goes Sahasrara → Soma ("between Ajna and Sahasrara"), reading as a regression. Either move Day 7 Kalaratri to "between Ajna and Sahasrara" OR relabel Soma chakra as transcendent ("above Sahasrara"). Pick one and apply consistently.
6. **`src/config/navratri.ts:397` — Ardhanarishvara-from-Siddhidatri claim.** A 19th-century Bengali tradition reading presented as canonical; classical sources derive Ardhanarishvara from Shiva-Parvati union, not Siddhidatri-grace. Drop or properly attribute.
7. **`src/config/pujas.ts:919-920` — Source attribution mismatch.** Says "Ganesha Purana" for the durva-21 + tulsi-forbidden rule; the variant note at line 927 (correctly) cites Brahmavaivarta Purana. Change to "Brahmavaivarta Purana, Prakriti Khanda ch 21".
8. **`src/config/pujas.ts:1326-1328` — Navagraha grain/flower issues.** Add variant notes: (a) Chandra/Shukra both being "rice" / "white rice" is regional; (b) Ketu's flower "red oleander" is one of several options (kusha grass / multi-color also valid); (c) "durva" (Budh) is a grass, not a flower — relabel section as "botanicals".
9. **`src/config/pujas.ts:1376-1381` — Navagraha invocation mantra mislabel.** "Brahma Murari Tripurantakari…" is a *morning navagraha vandana* (prabhāta-stuti), not the formal avahana. Relabel; or supplement with the per-graha bīja-mantras as a separate sub-step.
10. **`src/config/navratri.ts:727-730` — Mantra-pattern lineage undisclosed.** The 9 Navadurga mantras all use the simple `oṁ devī <form>āyai namaḥ` pattern (Devi-Mahatmya commentary lineage). Other lineages prefix bījas (`hrīṁ`, `śrīṁ`, `klīṁ`). Extend `NAVRATRI_SOURCES` to disclose the lineage choice.
11. **`src/config/pujas.ts:434, 603, 776, 944, 1146, 1314, 1478` — 7 puja `kicker` strings.** Borderline against `feedback_no_decorative_taglines.md` ("THE PURNIMA HOUSEHOLD PUJA", "PRATHAM PUJYA · BEGIN ANY UNDERTAKING", "BAJRANGBALI", etc.). They're more descriptive (when/who) than the rejected examples ("The Pantheon", "Thirty-three koṭi"), but still embellished. Decide: drop them all OR add a JSDoc comment explicitly justifying them as descriptive context.
12. **`src/config/vaarDevata.ts` — Weekday-mantra type inconsistency.** Mon = pure deity (`oṁ namaḥ śivāya`); Tue/Sat = graha-bīja (`oṁ haṁ hanumate`, `oṁ śaṁ śanaiścarāya`); Fri = deity-bīja (`oṁ śrīṁ mahālakṣmyai`); Thu = Vishnu mantra (`oṁ namo bhagavate vāsudevāya`). No internal rule. Decide on a consistent rule across all 7 days OR add a per-day `mantraVariantNote` documenting the choice.

**Minor (fold in opportunistically):**

13. `src/config/vaarDevata.ts:189-194` — Bhairava-Ravivara-Vrat note: rare tradition, weak attribution. Replace with Aditya Hridaya Stotra reference (already in Sunday's deity note) OR strengthen with citation.
14. `src/config/pujas.ts:813-823` — Ganesh Prana-Pratishtha step says "with the prescribed mantra" but cites no mantra. Either include a placeholder Prana-Pratishtha mantra (with `reviewPending: true`) or reword to "follow the household's tradition; consult a pandit for the formal mantra".
15. `src/config/pujas.ts:1416-1422` — Navagraha Stotra (Vyasa) referenced but its opening shloka isn't inline. Other pujas show their headline mantras (Mahamrityunjaya, kshama-prarthana). Add `japākusumasaṅkāśam…` opening with `reviewPending: true`.
16. `src/config/navratri.ts:294-296` — Skandamata iconography "seated on a lotus … rides a lion" parses contradictory. Reword: "rides a lion, seated on a lotus throne on its back".
17. `src/config/navratri.ts:474-475` — "Tripura Sundari" → "Tripurasundari" (canonical Sanskrit).
18. `src/config/navratri.ts` Saptashati outline — surface the JSDoc note about other-tradition chapter groupings on the screen as a one-line caption.

**Hard rules (carried over from Phase 14, unchanged):**

- **No new deities** to `src/config/deities.ts` — the 19-deity roster is fixed. Any figure outside the roster (Murugan, Brihaspati, Shani Dev, Bhairava, Mahavidyas, Navagrahas, Satyanarayan-as-Vishnu) appears as text only.
- **Do not flip any `reviewPending: true` to `false`** — that's the Sanskrit-reviewer pass, not P14.6. P14.6 may *add* `reviewPending: true` flags to newly-introduced mantra text (items 14, 15) but cannot clear existing ones.
- **No decorative editorial taglines** (`feedback_no_decorative_taglines.md`).
- **Roster-side cross-link discipline** unchanged: cross-links live in `src/config/pujas.ts` lookups, never inline in `app/festivals.tsx` or `app/(tabs)/panchang.tsx`.

**Out of scope for P14.6:**

- The Sanskrit-reviewer pass on existing mantra strings (separate combined item — see closure note).
- The full verse-by-verse Durga Saptashati text (separate ~700-verse content project, deferred under P14.3).
- Live-device smoke testing of the bundled branch (separate pre-release gate, see closure note).

### Phase 14 Exit Criteria

- P14.1: ✅ 7-day Vaar Devata — Home card + detail screen, **deities shown at equal weight (no per-day "primary")**, variant notes labeled, Isht Devata + Kundli-remedy tie-ins wired (dignity / Dosha / Sade Sati / Dasha). **Remaining:** the qualified-reviewer pass on the mantra strings — until then they ship `reviewPending: true` with a "provisional" caption (4 of 7 already match the `hindu-devotional-texts` package verbatim).
- P14.2: ✅ Seven Featured Pujas on the Shodashopachara template ([`src/config/pujas.ts`](src/config/pujas.ts) — Satyanarayan Katha, Lakshmi/Diwali, Ganesh, Rudrabhishek, Hanuman, Navagraha Shanti, Navratri Ghatasthapana). Detail route [`app/puja/[slug].tsx`](app/puja/[slug].tsx) + listing [`app/puja/index.tsx`](app/puja/index.tsx). Each puja = bilingual "when/why" blurb, interactive samagri checklist (transient per-session, grouped by category), Sankalpa template with gotra/name/place placeholders, pre-arc (purification → Sankalpa → Kalash → Prana Pratishtha for new idols → Ganesh-smarana), the 16 upacharas (parameterised over `STANDARD_UPACHARAS`), post-arc (havan / katha / visarjana-vs-Uttapana), stotra/katha cross-link card, post-puja deep links (aarti / chalisa / Jaap counter / Vaar Devata / Festivals / informational muhurat chips), source attribution, regional variant notes, accuracy-banner + footer disclaimer. **Cross-links wired from the puja side** (no festival-specific code added to `festivals.tsx`): Pujas tab "Puja Vidhi" row flipped active → `/puja`; deity detail (Ganesh/Lakshmi/Hanuman/Vishnu/Shiva/Durga) gets an "Open the Puja" CTA chip; Festivals rows whose name/description match a puja's `festivalMatchers` show "OPEN {{name}}"; Vaar Devata renders all featured pujas whose primary deity is in today's roster (Mon→Rudrabhishek, Tue+Sat→Hanuman, Wed→Ganesh, Thu→Satyanarayan, Fri→Lakshmi); Navratri Day-1 Ghatasthapana muhurat card links into the Ghatasthapana puja vidhi. Mantras all carry `reviewPending: true` with a "provisional — under scholarly review" banner; the roster constraint holds (Navagraha and Satyanarayan-as-Vishnu named as text only). **Remaining:** qualified-reviewer pass on the mantra strings — folded into the combined Sanskrit-reviewer debt with P14.1 + P14.3 (see Phase 14 closure note). **Deferred:** P14.2b Guided Mode (auto-start Jaap counter at the mantra step, step-by-step walkthrough), Vishnu Sahasranama archana, Saraswati Puja, Mahamrityunjaya jaap (partly served by counter), Griha Pravesh.
- P14.3: ✅ Sharad-Navratri 9-day guide — Day-1 read from `festivals.json` (`Sharad Navaratri` entry); Days 2–9 = Day 1 + N days; Day 10 from the `Dussehra` entry. **Chaitra Day 1 derived from `Rama Navami` − 8 days.** No `convertHinduToGregorian` at app-time — the dates are already baked into the pre-generated `festivals.json` from the build script, and we re-used that. Ghatasthapana muhurat (first-third-of-day-while-Pratipada window + Abhijit fallback + Chitra/Vaidhriti caption flags) is the only panchang-ts call left in the screen, `getDailyPanchang` on Day 1 only, memoised per-render. Per-day form/iconography/mantra (`reviewPending: true`)/dhyana/bhog/chakra in `src/config/navratri.ts`. **Panchang-computed colors via the Drik 9-day weekday cycle** (primary + secondary on weekday recurrence, never hardcoded per goddess) in `src/services/astrology/navratri.ts`. Daily notifications (Days 1–9 + Day 10 Vijayadashami) gated by `prefs.festival.major`. Vrat-guide screen with 4 tiers + allowed/forbidden food lists. Durga Saptashati outline + 9-day chapter map at `/scripture/durga-saptashati` (chapter titles + theme paragraphs `reviewPending`; full verses deferred to a separate content-review pass). Four Navratris handled — Sharad/Chaitra share the full guide, Magha + Ashadha Gupt surface a "Ten Mahavidyas, kept private" info card. **Surface:** dedicated 5th bottom tab **Practice** (`app/(tabs)/practice.tsx`) — replaces the earlier "Navratri header card on Festivals" decision (reverted; was a 2–3 s open-time regression on the calendar tab). Practice tab lists Navratri / Vrats / Saptashati / Vaar Devata / (Puja Vidhi coming soon) with subtitle text only — no panchang compute on tab mount. **Remaining:** a qualified-reviewer pass on the 9 bīja mantras + the dhyāna shlokas (until then they ship `reviewPending: true` with a "provisional" caption — same pattern as P14.1); the full verse-by-verse Saptashati Sanskrit text (its own ~700-verse content-review project).
- P14.4: ✅ Sadhana streak (`useStore.sadhana` slice with 26-hr grace + clock-rollback freeze in [`src/services/sadhana.ts`](src/services/sadhana.ts)) + cumulative counter derived from `getJaapStats` + sacred-number milestones (sessions 7/21/30/108/365; reps 108/1008/10800/108000; streak 7/21/30/108/365). Celebration overlay ([`src/components/common/MilestoneCelebrationHost.tsx`](src/components/common/MilestoneCelebrationHost.tsx)) mounted in `app/_layout.tsx`; Share button opens the new 5th `ShareCardSpec` kind `milestone`. Zero leaderboards/comparisons; opt-in evening reminder ([`src/services/sadhanaReminders.ts`](src/services/sadhanaReminders.ts), default off, 20:30, 14-day rolling horizon, skips today if already practised). SQLite `user_version` 5→6 for `milestones_achieved(kind, threshold, achieved_at)` with `UNIQUE(kind, threshold)` so re-crossings are idempotent. Zustand persist v14→v15. Streak badge on Home (under QuickRow) + Jaap picker stats card. **Aarti reader is NOT a streak signal in v1** — jaap-only, per PLAN; deferred until a clear "completed" event is added to the reader.
- P14.5: ✅ festival + deity + verse + jaap-completion cards via `captureRef` → `expo-sharing` (+ `expo-media-library` save-to-gallery), 1080-px renders (Story 9:16 / Square 1:1 toggle), app-watermarked, source-labelled text. Off-screen `<ShareCardHost>` in `app/_layout.tsx`; entry points on Festivals (major rows), deity detail hero, aarti verses, chalisa dohas, and the Jaap counter. **Plus** a separate "Share full text" affordance in the aarti + chalisa headers using RN `Share.share({ message })` — paste-into-WhatsApp ready, source + "shared via dharmagya" tail (image cards stay scoped to one-or-two lines per the source-text rule). **Not in v1 (unchanged):** name-personalized greetings, video status cards, WhatsApp-direct sharing.
- **P14.6:** ✅ All 4 critical items resolved (Hanuman Chalisa meter, besan re-categorisation, turmeric/hing softening, Navratri 11th notification — Day-1 Ghatasthapana muhurat T-30min reminder). All 8 significant items resolved (chakra ascent monotonised, Ardhanarishvara claim reframed, Brahmavaivarta attribution, Navagraha botanicals re-labelled, vandana-vs-avahana distinction, mantra-lineage disclosure, puja-kicker JSDoc, weekday-mantra `variantNote`). All 6 minor items resolved (Aditya Hridaya note, Prāṇa-pratiṣṭhā placeholder + Navagraha-Stotra opening both with `reviewPending: true`, Skandamata iconography, Tripurasundari spelling, Saptashati caption surfaced). Memory: `project_p14_6_landed.md`.
- `tsc --noEmit` clean; `npx expo lint` ≤ 8 warnings throughout. New content carries source attribution; the no-new-deities roster constraint holds.

### Phase 14 — closure note (updated 2026-05-28)

Phase 14 is **fully shipped to production.** All six sub-phases (P14.1–P14.6) merged from `phase_14` into `master` and released in the Phase-14 bundle (app version 1.9.1 / versionCode 13). The only outstanding Phase 14 debt is the **Sanskrit-reviewer pass on mantra strings** — tracked under §7 above, not as a Phase 14 sub-phase. Until that pass lands, mantras keep `reviewPending: true` and surface the "provisional — under scholarly review" caption in-screen; no functional UI work depends on it.

---

## 9. Pending — Phase 15 — Accounts & Sync (Google Sign-In) ⏳

**Why (2026-05-12, researched against Expo/Firebase/Google/Apple official docs):** requested feature. The app is currently 100% offline with no accounts and no backend; sign-in is the first backend the app has had, so it's deliberately phased — and gated on a clear answer to "what is login *for*." The answer: **so a user's mantra/sadhana streak (P14.4), birth charts, favorites, and settings survive a reinstall or a new phone** — the highest-value, lowest-controversy use. (Indian devotional apps mostly use phone-OTP; Google sign-in skews to the kundli-literate user this app already serves, so it's a fine first provider — phone-OTP can be added later.) **Genuinely free at this app's scale:** Google OAuth for `email`+`profile`+`openid` is free and exempt from sensitive-scope verification — the only setup cost is a privacy-policy URL on the consent screen.

### P15.A — Google Sign-In, local-only ⏳ (built 2026-05-16, **removed 2026-05-19** per user — "remove the google login for now"; ~1–2 days to rebuild)

`@react-native-google-signin/google-signin` (the library Expo's docs now point to; needs a dev build — already how this app ships; not Expo Go). Google Cloud project + OAuth client IDs (Android + Web now; iOS later), **all three SHA-1s registered** (local-debug, EAS, Play-Store signing key — the #1 setup gotcha; use the config-doctor), `google-services.json` checked in. Sign-in/out UI in Settings; store the ID token + profile in the existing Zustand KV. **No backend yet** — ship this, see if users actually sign in. (If uptake is low, P15.B can be deferred — A alone cost ~2 days.)

A working implementation was built 2026-05-16 then stripped per user request — see `memory/project_p15_a_landed.md` for the full rebuild checklist (TurboModule lazy-load gotcha; user-side Google Cloud setup; SHA-1 registration; `google-services.json` integration order). Re-attempt blocked until the user reopens the feature.

### P15.B — Sync backend ⏳ (~3–5 days)

Stand up the app's first backend. Cheapest path that fits — **Cloudflare Workers + D1** (the plan already anticipates Cloudflare R2 for P5.1 audio; Workers Free ≈ 100k req/day, D1 Free ≈ 5M row-reads + 100k row-writes/day — verify current limits; effectively free at any realistic scale here). The Worker verifies the Google ID token server-side (`oauth2.googleapis.com/tokeninfo`), issues a session; D1 holds `user_profile / favorites / birth_charts / jaap_history+streak / settings` (~5–50 KB/user). App syncs on sign-in (last-write-wins on a client timestamp for v1) + a delete-account endpoint. **Managed alternative if preferred:** Firebase Auth (≈50k MAU free) + Firestore (≈50k reads / 20k writes per day free) — less code, but vendor lock-in + a Blaze-plan cliff. Supabase free tier pauses idle projects after a week (bad for production).

### P15.C — Compliance ⏳ (parallel with B, ~0.5–1 day)

Triggered the moment accounts exist: privacy-policy update covering Google-data handling + storage vendor + retention + deletion; **in-app "Delete Account"** flow (Settings → Account) wiping all synced data; a **web account-deletion page** (a form/support page qualifies) — both mandatory under Google Play's account-deletion policy (enforced since May 2024); Play Console Data Safety form updated (email/name/synced-data, encryption in transit + at rest); privacy-policy URL registered on the OAuth consent screen; honour Google's limited-use terms (no ad use of Google data).

### P15.D — Sign in with Apple ⏳ (at iOS launch only, ~1 day)

App Store Guideline 4.8: an iOS app offering Google sign-in for the primary account must also offer an equivalent — Apple is the practical choice (`expo-apple-authentication`, dev-build friendly). Not needed for Android. Just another provider on the same user record once the backend exists. **Until this lands, don't tell users their account works on iOS** — it'll wall at App Review.

### Phase 15 Exit Criteria

- P15.A: Google sign-in works across local-debug / EAS / Play-Store builds; sign-in state in Settings; no backend.
- P15.B: backend live; favorites + birth charts + jaap-streak + settings round-trip on sign-in; account-deletion endpoint exists.
- P15.C: privacy policy updated + URL on consent screen; in-app + web account deletion live; Data Safety form updated.
- P15.D: (iOS only) Sign in with Apple offered alongside Google.
- Decision gate before B: if P15.A shows low sign-in uptake, B can be deferred.

---

## 10. Pending — Phase 3 — Multilingual Expansion (P3.1) ⏳

**Sequencing note:** Languages are last in the active queue (after Phase 14 + 15). Will be its own dedicated PR. Regional rollout is content-heavy and shouldn't compete with feature velocity.

**Why:** Drik Panchang supports 10 languages, AstroSage 9. Without regional languages we can't compete in Maharashtra, Gujarat, Tamil Nadu, Andhra/Telangana.

**Implementation:**
- Add 4 i18n bundles (`mr`, `gu`, `ta`, `te`); existing lazy-load retained.
- Translate UI strings — Tier 1 (nav, settings, panchang labels, notification templates, onboarding) ships with the language toggle. MT (DeepL/Google) + native-speaker QA (1 freelancer × 4–6h per language).
- Font loading: NSD already covers Devanāgarī (Marathi). Add `@expo-google-fonts/noto-serif-tamil`, `noto-serif-telugu`, `noto-serif-gujarati`. Verify no Android rendering regressions.
- Panchang terminology: extend `src/config/panchang-labels.ts` with regional transliterations (tithi/nakshatra/yoga).
- Settings language picker: 4 new rows below en/hi/sa.
- **Gate:** do not ship a language publicly until Tier 1 UI strings are QA-passed AND devotional content for that language exists in the consumed text package. Keep it behind a flag until then.

**Order:** Marathi first (largest contiguous market, NSD already loaded), then Gujarati, then Tamil, then Telugu. One language per release.

### Phase 3 Exit Criteria

- 4 new languages shipped with Tier 1 UI strings complete and per-language gating cleared.

---

## 11. Deferred — iOS widget + Phase 5

### iOS WidgetKit (originally P4.2 second half) ⏸

Android widget scaffold shipped 2026-05-06 (see §6). iOS WidgetKit extension deferred — app currently ships Android-only on Play Store; iOS launch will happen after broader app refinement. Pick up the iOS half once the app is stabilised enough to be worth a parallel App Store rollout. (Sign in with Apple — P15.D — also blocks on the iOS launch.)

### Phase 5 — Audio / booking / social (on hold)

**User directive (2026-04-12):** hold until current feature work lands. Operationally heavy, should not block competitive-parity features.

- **P5.1 Audio playback** for aarti/chalisa/mantra. Single biggest retention feature per competitor analysis. Unblocks Read Along Mode. Significant content-licensing budget. Cloudflare R2 for hosting.
- **P5.2 Puja booking / astrologer consult / e-commerce.** Sri Mandir's primary revenue driver (~$12M ARR). Requires temple partnerships, Razorpay/UPI, ops team. Don't start without an ops co-founder.
- **P5.3 Social / community / sharing / video.** Static-card sharing ships in P14.5; native share sheet is shippable any time; community + video need infrastructure + moderation overhead.

---

## 12. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier.
- Live streaming temple darshan.
- AI chat astrologer (hallucination risk on religious content).
- Cryptocurrency / NFTs / Web3.
- Landscape detailed calendar route (originally P10.1, dropped 2026-05-08). Densified Panchang grid from Phase 9 covers the almanac-page use case; not worth the orientation-lock complexity.
- `react-native-shared-element` for shared-element screen transitions — crashes on Android + Fabric in RN 0.81. Use Reanimated layout animations / opacity fades instead.
- Public leaderboards / "most prayers" rankings of any kind (P14.4 is private milestones only — gamifying devotion competitively is culturally wrong here; every Hindu/meditation app that works avoids it).
- Posting programmatically to WhatsApp Status — no such API exists; P14.5 hands images to the system share sheet, the user posts.
- New Library deities (the existing roster is fixed; Phase 14 content maps onto it).

---

## 13. Phase Dependencies Summary

**Sequencing principle:** ship optimizations + features first, language support last.

```
Shipped to production (through 2026-05-28, app 1.9.1 / versionCode 13):
  Phase 1 → 1.5 → 2 → 3.3 → 6 → 7.1–7.3 → 8.1 → 8.2 → 8.3 (+ panchang-ts 3.1.0)
  → 1.7.0 launch → 9 → P4.2 (Android widget) → Phase 10 → Phase 11
  (incl. P7.4→P11.6, P7.6→P11.5) → Phase 12 (panchang-ts 4.0.0)
  → Phase 13 (panchang-ts 4.1.1) → Bundle 2026-05-12
        ↓
  Phase 14 (P14.1–P14.6 all ✅) + Katha feature + Bhagavad Gita / Sundarkand readers
  + SDK 56 upgrade (Expo 54→56, RN 0.81.5→0.85.3, React 19.2.3, TS 6.0) → bundled
  release on master
        ↓
PENDING — in priority order:
  1. Sanskrit-reviewer pass on Phase 14 mantra strings (vaarDevata / pujas / navratri)
        — currently flagged `reviewPending: true`; one human engagement
  2. Sentry (`@sentry/react-native`, ~half day; can slot in any time)
  3. Phase 15 — Accounts & Sync (Google Sign-In)
        P15.A (REBUILD — removed 2026-05-19) → P15.B Cloudflare Workers + D1 backend
        → P15.C compliance (privacy policy, in-app + web account-deletion)
        → P15.D Sign in with Apple (at iOS launch only)
  4. Phase 3 (P3.1 languages — Marathi → Gujarati → Tamil → Telugu, one per release)
  5. iOS WidgetKit (gated on iOS launch)
  6. Phase 5 (on hold — P5.1 audio / P5.2 booking / P5.3 social)
```

**Release cadence:** the user decides when to ship. Bundle multiple phases into one larger release rather than shipping each phase independently — the user prefers one substantive update over many small ones.
