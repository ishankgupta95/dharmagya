import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';
import type { AyanamsaType } from 'panchang-ts';

import { INDIAN_CITIES } from '@/config/cities';
import type { AppLanguage } from '@/i18n';
import {
  DEFAULT_WIDGET_SLOTS,
  WIDGET_FIELD_IDS,
  type WidgetFieldId,
} from '@/services/widgets/widgetFields';
import { INITIAL_SADHANA_STATE, type SadhanaState } from '@/services/sadhana';

export type FontSize = 'small' | 'normal' | 'medium' | 'large';
export type MasaSystem = 'purnimanta' | 'amanta';
export type TimeFormat = 'auto' | '12h' | '24h';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Ayanamsa = AyanamsaType;
export type ChartStyle = 'north' | 'south';
export type HouseSystem = 'whole-sign' | 'equal' | 'placidus-kp';
export type Sex = 'male' | 'female';

/** What the user came to the app for (P16.6 onboarding keystone). Multi-select;
 *  the first entry is the "primary" intent that drives Home hero order, the
 *  Home primary-action button, and the Kundli default view. Re-editable in
 *  Settings — never a one-way persona trap. Defaults to ['worship']. */
export type IntentKey = 'worship' | 'panchang' | 'kundli';

/** Scopes region-specific festival variants (Pongal, Vishu, Baisakhi, Gudi
 *  Padwa, Lohri, Bonalu, …). Mirrors panchang-ts v2.1 FestivalRegion —
 *  state-slug naming. Default 'all' emits every regional variant. */
export type Region =
  | 'all'
  // South
  | 'tamil-nadu'
  | 'kerala'
  | 'karnataka'
  | 'andhra-pradesh'
  | 'telangana'
  // East
  | 'west-bengal'
  | 'odisha'
  | 'assam'
  | 'bihar'
  | 'jharkhand'
  // West
  | 'gujarat'
  | 'maharashtra'
  | 'goa'
  | 'rajasthan'
  // North
  | 'punjab'
  | 'haryana'
  | 'himachal-pradesh'
  | 'uttarakhand'
  | 'uttar-pradesh'
  | 'madhya-pradesh'
  // International
  | 'nepal';

// Tithi-based recurring reminders (1 day before, 7 PM evening).
export type TithiReminderKey =
  | 'ekadashi'
  | 'pradosha'
  | 'purnima'
  | 'amavasya'
  | 'sankashti'
  | 'shivaratri';

// Festival-category reminders (1 day before, 8 PM evening).
export type FestivalReminderKey = 'major' | 'minor' | 'ekadashi' | 'pradosha' | 'sankranti';

export interface ReminderPrefs {
  tithi: Record<TithiReminderKey, boolean>;
  festival: Record<FestivalReminderKey, boolean>;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  tithi: {
    ekadashi: false,
    pradosha: false,
    purnima: false,
    amavasya: false,
    sankashti: false,
    shivaratri: false,
  },
  festival: {
    major: false,
    minor: false,
    ekadashi: false,
    pradosha: false,
    sankranti: false,
  },
};

/**
 * walkthroughStep values:
 *  0  = completed / skipped
 *  1  = Home → highlight panchang card (tap → go to Panchang)
 *  2  = Panchang → explain the screen (tap Next → go to Library)
 *  3  = Library → explain the screen (tap Next → finish)
 */
interface AppStore {
  // Persisted
  /** User preference. 'system' follows the OS color scheme. */
  themeMode: ThemeMode;
  /** Resolved boolean ('themeMode' + system scheme). Synced at runtime in
   *  _layout.tsx; persisted so first paint matches the last known value. */
  isDarkMode: boolean;
  favoriteIds: string[]; // Stores both aarti and chalisa IDs (prefixed: "aarti-*", "chalisa-*")
  /** Diya reader — last focused verse per text (key: "chalisa-hanuman"), so
   *  returning to a reader lands on the saved verse. */
  readingPositions: Record<string, number>;
  /** Most recently read text — drives the Library "Continue" card. */
  lastReadKey: string | null;
  hasOnboarded: boolean;
  /** Onboarding intent (P16.6). Multi-select; [0] is primary. Defaults to
   *  ['worship']. Drives Home hero order + primary action + Kundli default. */
  primaryIntent: IntentKey[];
  selectedDeities: string[];
  /** Where the panchang is computed for. `timezone` is set only when the place
   *  was *chosen* (a curated city, or the Ujjain default) — a live GPS fix
   *  omits it, because the device is standing at those coordinates and its own
   *  offset is the correct one. Entries persisted before this field existed
   *  have no timezone and keep the device-offset behaviour. */
  userLocation: { lat: number; lon: number; timezone?: string } | null;
  locationName: string | null; // e.g. "Mumbai, MH" or "GPS"
  fontSize: FontSize;
  language: AppLanguage;
  masaSystem: MasaSystem;
  region: Region;
  /** Sidereal-zodiac convention used for all panchang calculations.
   *  Lahiri = official Indian government standard; Raman / KP are alternatives. */
  ayanamsa: Ayanamsa;
  /** North Indian (diamond) or South Indian (square) kundli chart layout. */
  chartStyle: ChartStyle;
  /** House system used by birth-chart APIs (lagna / bhava / D-charts). */
  houseSystem: HouseSystem;
  dailyReminderEnabled: boolean;
  /** HH:mm in 24h. */
  dailyReminderTime: string;
  sunriseAlertEnabled: boolean;
  /** Minutes BEFORE sunrise the alert should fire. */
  sunriseAlertOffsetMin: number;
  reminderPrefs: ReminderPrefs;
  /** HH:mm in 24h — when tithi reminders fire on the evening before. */
  tithiReminderTime: string;
  /** HH:mm in 24h — when festival reminders fire on the evening before. */
  festivalReminderTime: string;
  /** Render numbers (dates, times, counts) in Devanagari (०-९). */
  useDevanagariNumerals: boolean;
  /** 'auto' = let device locale decide; otherwise force 12h/24h. */
  timeFormat: TimeFormat;
  /** When true, suppress notifications during the configured quiet window. */
  quietHoursEnabled: boolean;
  /** HH:mm 24h — quiet window start. */
  quietHoursStart: string;
  /** HH:mm 24h — quiet window end. */
  quietHoursEnd: string;
  /** Show the Vikram Samvat year in panchang headers. */
  showVikramSamvat: boolean;
  /** 'compact' = the original Sun-leading 7-col grid. 'dense' = transposed
   *  view with 7 weekday rows × 6 week cols, each cell carrying tithi+paksha
   *  and the day's primary event. Toggle is exposed in the month strip. */
  panchangLayout: 'compact' | 'dense';
  /** Open/closed state for each category accordion on the panchang day-detail.
   *  Keyed by category slug; absent = closed. Persisted so a user who always
   *  opens "Inauspicious Times" doesn't have to re-expand it daily. The
   *  accordion drives lazy compute — no daily-panchang fetch fires until the
   *  first category is expanded for the selected date. */
  panchangCategoriesOpen: Record<string, boolean>;
  /** ISO YYYY-MM-DD, or null if not set. */
  userBirthDate: string | null;
  /** HH:mm in 24h, or null if not set. Used to refine Vimshottari dasha balance. */
  userBirthTime: string | null;
  /** Birth coordinates + label + IANA timezone, or null if not set. The
   *  timezone is required so panchang-ts compute interprets the birth time
   *  in the *birthplace*'s local time, not the device's. */
  userBirthPlace: { lat: number; lon: number; name: string; timezone: string } | null;
  /** Biological sex; required by Ashtakoot matching to assign Vara/Vadhu roles.
   *  Null until the user opts to set it (kept optional outside of matching). */
  userSex: Sex | null;
  /** Display name. Optional — only used to label "your" chart in match views.
   *  Trimmed before save; null when the user hasn't entered anything. */
  userName: string | null;
  walkthroughStep: number;
  /** Timestamp (ms) of when the user first opened the app. Used for first-session ad grace period. */
  firstOpenTimestamp: number;
  /** Today's-Panchang home-screen widget — the four user-pickable info slots
   *  (top-main, mid-main, footer-left, footer-right). Each entry is a field
   *  ID from the widget catalog (tithi/yoga/sunset/...). */
  widgetSlots: [WidgetFieldId, WidgetFieldId, WidgetFieldId, WidgetFieldId];
  /** Sadhana streak state (P14.4). Pure data — math lives in
   *  [`src/services/sadhana.ts`](../services/sadhana.ts); the store is only
   *  the persistence + reactive surface. */
  sadhana: SadhanaState;
  /** Opt-in evening at-risk reminder. Off by default — gentle nudge, not a
   *  loss threat. */
  sadhanaReminderEnabled: boolean;
  /** HH:mm 24h — evening time the at-risk reminder fires when enabled. */
  sadhanaReminderTime: string;

  // Actions (not persisted)
  setThemeMode: (mode: ThemeMode) => void;
  /** Internal: called by _layout.tsx whenever themeMode or system scheme changes. */
  setResolvedDarkMode: (val: boolean) => void;
  toggleFavorite: (id: string) => void;
  setReadingPosition: (key: string, index: number) => void;
  setUserLocation: (loc: { lat: number; lon: number; timezone?: string }, name?: string) => void;
  setHasOnboarded: () => void;
  setPrimaryIntent: (intents: IntentKey[]) => void;
  setSelectedDeities: (deities: string[]) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: AppLanguage) => void;
  setMasaSystem: (system: MasaSystem) => void;
  setRegion: (region: Region) => void;
  setAyanamsa: (a: Ayanamsa) => void;
  setChartStyle: (s: ChartStyle) => void;
  setHouseSystem: (h: HouseSystem) => void;
  setDailyReminderEnabled: (val: boolean) => void;
  setDailyReminderTime: (timeHHmm: string) => void;
  setSunriseAlertEnabled: (val: boolean) => void;
  setSunriseAlertOffsetMin: (min: number) => void;
  setTithiReminder: (key: TithiReminderKey, val: boolean) => void;
  setFestivalReminder: (key: FestivalReminderKey, val: boolean) => void;
  setTithiReminderTime: (timeHHmm: string) => void;
  setFestivalReminderTime: (timeHHmm: string) => void;
  setUseDevanagariNumerals: (val: boolean) => void;
  setTimeFormat: (fmt: TimeFormat) => void;
  setQuietHoursEnabled: (val: boolean) => void;
  setQuietHoursStart: (timeHHmm: string) => void;
  setQuietHoursEnd: (timeHHmm: string) => void;
  setShowVikramSamvat: (val: boolean) => void;
  setPanchangLayout: (layout: 'compact' | 'dense') => void;
  togglePanchangCategory: (key: string) => void;
  setUserBirthDate: (iso: string | null) => void;
  setUserBirthTime: (hhmm: string | null) => void;
  setUserBirthPlace: (place: { lat: number; lon: number; name: string; timezone: string } | null) => void;
  setUserSex: (sex: Sex | null) => void;
  setUserName: (name: string | null) => void;
  setWalkthroughStep: (step: number) => void;
  initFirstOpen: () => void;
  setWidgetSlot: (index: 0 | 1 | 2 | 3, fieldId: WidgetFieldId) => void;
  /** Replace the entire sadhana slice — used by the streak recorder which
   *  passes in the result of `recordSadhanaEvent`. */
  setSadhanaState: (next: SadhanaState) => void;
  setSadhanaReminderEnabled: (val: boolean) => void;
  setSadhanaReminderTime: (timeHHmm: string) => void;
}

// ─── Persistence: hydration gate ─────────────────────────────────────────────
//
// THE RACE. zustand's persist middleware serialises `partialize(get())` to
// storage on EVERY `set`: the wrapped `set` and `api.setState` both call
// `setItem()` unconditionally (node_modules/zustand/esm/middleware.mjs,
// `persistImpl`). `hydrate()` reads storage asynchronously, applies the result
// with the RAW `set`, and only writes back when a migration ran. Between store
// creation and the kv-store SELECT resolving, the store therefore holds the
// DEFAULTS, and any `set` in that window overwrites the user's real blob on
// disk with the default slice — hasOnboarded false, no birth details, no
// favourites. The late hydrate then restores MEMORY from the value it read a
// moment earlier, so the session looks fine; but disk stays at defaults until
// the next write, and if none happens that session the next launch is a fresh
// install. The confirmed trigger was RootLayout's theme effect on its first
// commit: on a light-scheme device with themeMode 'system' the default
// `isDarkMode: true` differs, `setResolvedDarkMode(false)` fires, and that is
// enough. (Reproduced with zustand 5.0.15 + a FIFO async storage: disk after
// launch == defaults.)
//
// THE GATE. `setItem` on the storage handed to persist is a no-op until the
// cold-start hydrate has SETTLED — success OR failure — which the callback
// returned from `onRehydrateStorage` reports (zustand v5 calls it with
// `(state)` on success and `(undefined, error)` on rejection; see `hydrate()`
// in the file above). Reads are untouched. What this buys:
//   · No write can reach disk before the read has been applied: the callback
//     fires after `set(stateFromStorage, true)`, in the same tick.
//   · Writes re-open on a REJECTED hydrate too (corrupt JSON, a storage
//     fault). A fresh install with broken storage must still be able to
//     persist onboarding, and defaults beat a permanent splash.
//   · A dropped write is not lost. Every persist write is the FULL slice, so
//     the next `set` after settle re-writes everything. One write does fall
//     in the closed window legitimately — the migration write-back, which
//     `hydrate()` issues before the callback — so if anything was dropped the
//     callback re-flushes the settled state once. Without that a bumped
//     `version` would only reach disk on the next unrelated write, and every
//     launch until then would re-run the migration.
//
// RootLayout also gates its theme effect on hydration, so in practice the gate
// should never have to drop anything (it warns once in __DEV__ if it does).
// The gate is the belt; the layout gate is the braces.
//
// Cold-start only: `persist.rehydrate()` and `persist.clearStorage()` are not
// used in this app. A manual rehydrate after settle would run gate-open.

export type StoreHydrationOutcome = { ok: true } | { ok: false; error: unknown };

let hydrationOutcome: StoreHydrationOutcome | null = null;
let droppedWriteBeforeSettle = false;
let warnedDroppedWrite = false;
const hydrationListeners = new Set<() => void>();

/** Cold-start hydration status as a `useSyncExternalStore`-shaped external
 *  store (same pattern as `useAdsReady`). `outcome()` is `null` until the
 *  hydrate has settled, then one stable object — never rebuilt, so it is safe
 *  as a snapshot. RootLayout uses it to tell "failed" (proceed on defaults
 *  now) from "still reading" (keep the splash up). Unlike
 *  `persist.onFinishHydration`, which fires on success only, this settles on
 *  rejection as well. */
export const storeHydration = {
  outcome: (): StoreHydrationOutcome | null => hydrationOutcome,
  subscribe: (listener: () => void): (() => void) => {
    hydrationListeners.add(listener);
    return () => {
      hydrationListeners.delete(listener);
    };
  },
};

const STORE_NAME = 'dharmagya-store';
/** Bump together with a new `if (version < N)` step in `migrate` below. */
const STORE_VERSION = 17;

const gatedStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => {
    if (hydrationOutcome === null) {
      droppedWriteBeforeSettle = true;
      if (__DEV__ && !warnedDroppedWrite) {
        warnedDroppedWrite = true;
        console.warn(
          '[store] write before hydration settled was dropped; disk is re-flushed once the read lands',
        );
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(name, value);
  },
  removeItem: (name) => AsyncStorage.removeItem(name),
};

// Explicit allow-list of everything that is persisted today. Behaviour is
// identical to the previous no-`partialize` default (JSON.stringify was
// already dropping the action closures) — it just stops the serialiser
// walking the whole store object on every write. NOTHING may be dropped
// from this list without a migration: an omitted key silently stops
// persisting and the user loses it on next launch. When you add a field
// to AppStore's persisted section, add it here too.
const persistedSlice = (s: AppStore) => ({
  themeMode: s.themeMode,
  isDarkMode: s.isDarkMode,
  favoriteIds: s.favoriteIds,
  readingPositions: s.readingPositions,
  lastReadKey: s.lastReadKey,
  hasOnboarded: s.hasOnboarded,
  primaryIntent: s.primaryIntent,
  selectedDeities: s.selectedDeities,
  userLocation: s.userLocation,
  locationName: s.locationName,
  fontSize: s.fontSize,
  language: s.language,
  masaSystem: s.masaSystem,
  region: s.region,
  ayanamsa: s.ayanamsa,
  chartStyle: s.chartStyle,
  houseSystem: s.houseSystem,
  dailyReminderEnabled: s.dailyReminderEnabled,
  dailyReminderTime: s.dailyReminderTime,
  sunriseAlertEnabled: s.sunriseAlertEnabled,
  sunriseAlertOffsetMin: s.sunriseAlertOffsetMin,
  reminderPrefs: s.reminderPrefs,
  tithiReminderTime: s.tithiReminderTime,
  festivalReminderTime: s.festivalReminderTime,
  useDevanagariNumerals: s.useDevanagariNumerals,
  timeFormat: s.timeFormat,
  quietHoursEnabled: s.quietHoursEnabled,
  quietHoursStart: s.quietHoursStart,
  quietHoursEnd: s.quietHoursEnd,
  showVikramSamvat: s.showVikramSamvat,
  panchangLayout: s.panchangLayout,
  panchangCategoriesOpen: s.panchangCategoriesOpen,
  userBirthDate: s.userBirthDate,
  userBirthTime: s.userBirthTime,
  userBirthPlace: s.userBirthPlace,
  userSex: s.userSex,
  userName: s.userName,
  walkthroughStep: s.walkthroughStep,
  firstOpenTimestamp: s.firstOpenTimestamp,
  widgetSlots: s.widgetSlots,
  sadhana: s.sadhana,
  sadhanaReminderEnabled: s.sadhanaReminderEnabled,
  sadhanaReminderTime: s.sadhanaReminderTime,
});
type PersistedSlice = ReturnType<typeof persistedSlice>;

// Kept in a const so the post-hydration flush below writes through the SAME
// serialiser and `{ state, version }` envelope persist itself uses.
const jsonStorage = createJSONStorage<PersistedSlice>(() => gatedStorage);

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      themeMode: 'system' as ThemeMode,
      isDarkMode: true,
      favoriteIds: [],
      readingPositions: {},
      lastReadKey: null,
      hasOnboarded: false,
      primaryIntent: ['worship'] as IntentKey[],
      selectedDeities: [],
      userLocation: null,
      locationName: null,
      fontSize: 'normal',
      language: 'system' as AppLanguage,
      masaSystem: 'purnimanta' as MasaSystem,
      region: 'all' as Region,
      ayanamsa: 'lahiri' as Ayanamsa,
      chartStyle: 'north' as ChartStyle,
      houseSystem: 'whole-sign' as HouseSystem,
      dailyReminderEnabled: false,
      dailyReminderTime: '07:00',
      sunriseAlertEnabled: false,
      sunriseAlertOffsetMin: 0,
      reminderPrefs: DEFAULT_REMINDER_PREFS,
      tithiReminderTime: '19:00',
      festivalReminderTime: '20:00',
      useDevanagariNumerals: false,
      timeFormat: 'auto' as TimeFormat,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      showVikramSamvat: true,
      panchangLayout: 'compact',
      panchangCategoriesOpen: {},
      userBirthDate: null,
      userBirthTime: null,
      userBirthPlace: null,
      userSex: null,
      userName: null,
      walkthroughStep: 1,
      firstOpenTimestamp: 0,
      widgetSlots: [...DEFAULT_WIDGET_SLOTS],
      sadhana: { ...INITIAL_SADHANA_STATE },
      sadhanaReminderEnabled: false,
      sadhanaReminderTime: '20:30',

      setThemeMode: (mode) => set({ themeMode: mode }),
      // The no-op guards below bail out BEFORE `set` rather than returning `{}`
      // from it: an empty patch still allocates a new state object, notifies
      // every subscriber and triggers a full persist write.
      setResolvedDarkMode: (val) => {
        if (get().isDarkMode === val) return;
        set({ isDarkMode: val });
      },
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((fId) => fId !== id)
            : [...s.favoriteIds, id],
        })),
      setReadingPosition: (key, index) => {
        const s = get();
        if (s.readingPositions[key] === index && s.lastReadKey === key) return;
        set({
          readingPositions: { ...s.readingPositions, [key]: index },
          lastReadKey: key,
        });
      },
      setUserLocation: (loc, name) => set({ userLocation: loc, locationName: name ?? null }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      setPrimaryIntent: (intents) =>
        set({ primaryIntent: intents.length > 0 ? intents : (['worship'] as IntentKey[]) }),
      setSelectedDeities: (deities) => set({ selectedDeities: deities }),
      setFontSize: (size) => set({ fontSize: size }),
      setLanguage: (lang) => set({ language: lang }),
      setMasaSystem: (system) => set({ masaSystem: system }),
      setRegion: (region) => set({ region }),
      setAyanamsa: (a) => set({ ayanamsa: a }),
      setChartStyle: (s) => set({ chartStyle: s }),
      setHouseSystem: (h) => set({ houseSystem: h }),
      setDailyReminderEnabled: (val) => set({ dailyReminderEnabled: val }),
      setDailyReminderTime: (timeHHmm) => set({ dailyReminderTime: timeHHmm }),
      setSunriseAlertEnabled: (val) => set({ sunriseAlertEnabled: val }),
      setSunriseAlertOffsetMin: (min) => set({ sunriseAlertOffsetMin: min }),
      setTithiReminderTime: (timeHHmm) => set({ tithiReminderTime: timeHHmm }),
      setFestivalReminderTime: (timeHHmm) => set({ festivalReminderTime: timeHHmm }),
      setUseDevanagariNumerals: (val) => set({ useDevanagariNumerals: val }),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setQuietHoursEnabled: (val) => set({ quietHoursEnabled: val }),
      setQuietHoursStart: (timeHHmm) => set({ quietHoursStart: timeHHmm }),
      setQuietHoursEnd: (timeHHmm) => set({ quietHoursEnd: timeHHmm }),
      setShowVikramSamvat: (val) => set({ showVikramSamvat: val }),
      setPanchangLayout: (layout) => set({ panchangLayout: layout }),
      togglePanchangCategory: (key) => set((s) => ({
        panchangCategoriesOpen: {
          ...s.panchangCategoriesOpen,
          [key]: !s.panchangCategoriesOpen[key],
        },
      })),
      setTithiReminder: (key, val) =>
        set((s) => ({
          reminderPrefs: {
            ...s.reminderPrefs,
            tithi: { ...s.reminderPrefs.tithi, [key]: val },
          },
        })),
      setFestivalReminder: (key, val) =>
        set((s) => ({
          reminderPrefs: {
            ...s.reminderPrefs,
            festival: { ...s.reminderPrefs.festival, [key]: val },
          },
        })),
      setUserBirthDate: (iso) => set({ userBirthDate: iso }),
      setUserBirthTime: (hhmm) => set({ userBirthTime: hhmm }),
      setUserBirthPlace: (place) => set({ userBirthPlace: place }),
      setUserSex: (sex) => set({ userSex: sex }),
      setUserName: (name) => {
        const trimmed = name?.trim() ?? '';
        set({ userName: trimmed.length > 0 ? trimmed : null });
      },
      setWalkthroughStep: (step) => set({ walkthroughStep: step }),
      initFirstOpen: () => {
        if (get().firstOpenTimestamp) return;
        set({ firstOpenTimestamp: Date.now() });
      },
      setWidgetSlot: (index, fieldId) =>
        set((s) => {
          const next = [...s.widgetSlots] as [
            WidgetFieldId, WidgetFieldId, WidgetFieldId, WidgetFieldId,
          ];
          next[index] = fieldId;
          return { widgetSlots: next };
        }),
      setSadhanaState: (next) => set({ sadhana: next }),
      setSadhanaReminderEnabled: (val) => set({ sadhanaReminderEnabled: val }),
      setSadhanaReminderTime: (timeHHmm) => set({ sadhanaReminderTime: timeHHmm }),
    }),
    {
      name: STORE_NAME,
      storage: jsonStorage,
      version: STORE_VERSION,
      partialize: persistedSlice,
      // Opens the storage gate (see "Persistence: hydration gate" above) and
      // reports the outcome to `storeHydration` subscribers. zustand v5 calls
      // this with `(get(), undefined)` on success and `(undefined, error)` on
      // rejection; `state` is the discriminator so a thrown `undefined` still
      // classifies as a failure.
      onRehydrateStorage: () => (state, error) => {
        hydrationOutcome = state !== undefined ? { ok: true } : { ok: false, error };
        if (state !== undefined && droppedWriteBeforeSettle) {
          // Something was written while the gate was closed — in the normal
          // upgrade path that is the migration write-back. Re-flush the
          // settled state once so disk matches memory (and carries the new
          // version) without waiting for an unrelated `set`. Not on the error
          // path: the store holds defaults there, and the first genuine `set`
          // will write them anyway.
          Promise.resolve(
            jsonStorage?.setItem(STORE_NAME, {
              state: persistedSlice(state),
              version: STORE_VERSION,
            }),
          ).catch((e: unknown) => console.warn('[store] post-hydration flush failed', e));
        }
        hydrationListeners.forEach((listener) => listener());
      },
      migrate: (persistedState, version) => {
        const state = persistedState as (Partial<AppStore> & Record<string, unknown>) | null;
        if (!state) return persistedState as AppStore;

        // v0 → v1: Sanskrit was removed as a supported language.
        if (version < 1 && (state.language as string) === 'sa') {
          state.language = 'system';
        }

        // v1 → v2: aartis/chalisas now come from the hindu-devotional-texts
        // package (slug-keyed, one per deity). Migrate persisted lists from the
        // old display-name + numeric-suffix scheme to the package's slug scheme.
        if (version < 2) {
          // Display-name → slug map (matches ALL_DEITIES order in src/config/deities.ts).
          // Old-name keys cover both the legacy roster (incl. removed deities) and
          // the special-case `ganesh` -> `ganesha` rename.
          const NAME_TO_SLUG: Record<string, string> = {
            Ganesh: 'ganesha',
            Ganesha: 'ganesha',
            Shiva: 'shiva',
            Vishnu: 'vishnu',
            Hanuman: 'hanuman',
            Lakshmi: 'lakshmi',
            Krishna: 'krishna',
            Rama: 'rama',
            Durga: 'durga',
            Saraswati: 'saraswati',
            Parvati: 'parvati',
            Kali: 'kali',
            Surya: 'surya',
            Brahma: 'brahma',
            'Sai Baba': 'sai-baba',
            'Santoshi Mata': 'santoshi-mata',
            Sita: 'sita',
            'Khatu Shyam': 'khatu-shyam',
            'Vaishno Devi': 'vaishno-devi',
            Narasimha: 'narasimha',
          };
          const SUPPORTED_SLUGS = new Set(Object.values(NAME_TO_SLUG));

          // selectedDeities: previously stored as display names (e.g. "Ganesh");
          // also handle the literal `ganesh` -> `ganesha` slug rename.
          if (Array.isArray(state.selectedDeities)) {
            const migrated: string[] = [];
            for (const entry of state.selectedDeities) {
              const slug = NAME_TO_SLUG[entry] ?? (entry === 'ganesh' ? 'ganesha' : entry);
              if (SUPPORTED_SLUGS.has(slug) && !migrated.includes(slug)) {
                migrated.push(slug);
              }
            }
            state.selectedDeities = migrated;
          }

          // favoriteIds: old shape was `aarti-<id>`/`chalisa-<id>`/`katha-<id>`
          // where <id> looked like `aarti-hanuman-001`. New shape is
          // `aarti-<slug>` / `chalisa-<slug>`. Drop kathas; collapse numeric suffix.
          if (Array.isArray(state.favoriteIds)) {
            const migrated: string[] = [];
            for (const fav of state.favoriteIds) {
              if (fav.startsWith('katha-')) continue;
              let prefix: 'aarti-' | 'chalisa-' | null = null;
              if (fav.startsWith('aarti-')) prefix = 'aarti-';
              else if (fav.startsWith('chalisa-')) prefix = 'chalisa-';
              if (!prefix) continue;
              const rest = fav.slice(prefix.length);
              // Match `aarti-hanuman-001`, `chalisa-sai-baba-001`, etc.
              const m = rest.match(/^([a-z][a-z-]*?)(?:-\d+)?$/);
              if (!m) continue;
              const slug = m[1] === 'ganesh' ? 'ganesha' : m[1];
              if (!SUPPORTED_SLUGS.has(slug)) continue;
              const next = `${prefix}${slug}`;
              if (!migrated.includes(next)) migrated.push(next);
            }
            state.favoriteIds = migrated;
          }
        }

        // v2 → v3: Rashifal feature removed. Strip persisted `userRashi` field.
        if (version < 3) {
          delete (state as Record<string, unknown>).userRashi;
        }

        // v3 → v4: panchang-ts v2.1 renamed regions to state-slug scheme.
        // Map legacy values to canonical ones so the store stays in sync with
        // the new Region union (even though the library still accepts the old
        // strings with a deprecation warning).
        if (version < 4) {
          const LEGACY_REGION_MAP: Record<string, Region> = {
            tamil: 'tamil-nadu',
            bengal: 'west-bengal',
            'north-india': 'all',
          };
          const r = state.region as string | undefined;
          if (r && r in LEGACY_REGION_MAP) {
            state.region = LEGACY_REGION_MAP[r];
          }
        }

        // v4 → v5: font size scale was re-graded with finer mid-steps. The old
        // 'large' (1.5) became 'xl', and old 'xl' (1.9) → 'xxl'. Both 'xl' and
        // 'xxl' were dropped in v13, so any value emitted here is intermediate
        // and gets clamped back to 'large' by the v12→v13 step below. We keep
        // the assignment so the historical migration chain stays correct;
        // casts are required because 'xl'/'xxl' aren't valid `FontSize` now.
        if (version < 5) {
          const f = state.fontSize as string | undefined;
          if (f === 'large') state.fontSize = 'xl' as unknown as FontSize;
          else if (f === 'xl') state.fontSize = 'xxl' as unknown as FontSize;
        }

        // v5 → v6: themeMode introduced. Carry forward the user's existing
        // explicit dark/light choice so an upgrade isn't a surprise reset.
        if (version < 6) {
          if (state.themeMode === undefined) {
            state.themeMode = state.isDarkMode === false ? 'light' : 'dark';
          }
        }

        // v6 → v7: ayanamsa setting introduced. Default existing users to Lahiri,
        // which matches the previously hard-coded behaviour.
        if (version < 7) {
          if (state.ayanamsa === undefined) {
            state.ayanamsa = 'lahiri';
          }
        }

        // v7 → v8: kundli surface introduced. Default chart layout to North
        // Indian (diamond) and house system to whole-sign — both classical defaults.
        if (version < 8) {
          if (state.chartStyle === undefined) state.chartStyle = 'north';
          if (state.houseSystem === undefined) state.houseSystem = 'whole-sign';
        }

        // v8 → v9: userSex added (required by Ashtakoot matching). Stays null
        // for existing users — the match screen prompts them when first opened.
        if (version < 9) {
          if (state.userSex === undefined) state.userSex = null;
        }

        // v9 → v10: userName added (optional display label). Stays null for
        // existing users — only surfaces in match views when set.
        if (version < 10) {
          if (state.userName === undefined) state.userName = null;
        }

        // v10 → v11: userBirthPlace gained a `timezone` field so panchang-ts
        // compute can interpret the birth time in the birthplace's tz instead
        // of the device's. Backfill Asia/Kolkata — the only city list shipped
        // is the Indian district headquarters, all in IST.
        if (version < 11) {
          const place = state.userBirthPlace as
            | { lat: number; lon: number; name: string; timezone?: string }
            | null
            | undefined;
          if (place && !place.timezone) {
            state.userBirthPlace = { ...place, timezone: 'Asia/Kolkata' };
          }
        }

        // v11 → v12: Pancha Anga accordion default-open behaviour. Earlier
        // builds let the panchang screen toggle accordions open; users who
        // tested ended up with several `true` values stuck in storage. Reset
        // the open-set so the new "only Pancha Anga open by default" rule
        // applies cleanly. Users who actively want other categories open will
        // re-toggle them; their preferences then persist normally.
        if (version < 12) {
          state.panchangCategoriesOpen = {};
        }

        // v12 → v13: 'xl' and 'xxl' font-size steps removed (they over-scaled
        // hero typography on the Sacred Editorial design). Anyone who landed
        // on those gets clamped to 'large' so existing reading flows stay
        // readable; they can re-pick if they want.
        if (version < 13) {
          const f = state.fontSize as string | undefined;
          if (f === 'xl' || f === 'xxl') state.fontSize = 'large';
        }

        // v13 → v14: home-screen widget gained user-configurable slots. Seed
        // existing installs with the four fields the widget shipped with so
        // their content doesn't change on upgrade.
        if (version < 14) {
          const slots = state.widgetSlots as unknown[] | undefined;
          const valid = Array.isArray(slots)
            && slots.length === 4
            && slots.every((id) => typeof id === 'string' && (WIDGET_FIELD_IDS as string[]).includes(id));
          if (!valid) {
            state.widgetSlots = [...DEFAULT_WIDGET_SLOTS];
          }
        }

        // v14 → v15: Sadhana streak slice + opt-in at-risk reminder introduced
        // (P14.4). Existing users start at zero streak — they earn it from
        // their next jaap session forward; we don't retro-fill from history
        // because the 26h-grace event chain isn't reconstructable from raw
        // session timestamps alone (gaps near the boundary are ambiguous).
        if (version < 15) {
          if (state.sadhana === undefined) {
            state.sadhana = { ...INITIAL_SADHANA_STATE };
          }
          if (state.sadhanaReminderEnabled === undefined) {
            state.sadhanaReminderEnabled = false;
          }
          if (state.sadhanaReminderTime === undefined) {
            state.sadhanaReminderTime = '20:30';
          }
        }

        // v15 → v16: P16.6 onboarding intent. Existing users never picked one,
        // so seed the safe default ('worship') — the same fallback the skip
        // path uses. It's re-editable in Settings, so this is non-binding.
        if (version < 16) {
          const pi = state.primaryIntent as unknown;
          if (!Array.isArray(pi) || pi.length === 0) {
            state.primaryIntent = ['worship'];
          }
        }

        // v16 → v17: backfill `userLocation.timezone` for chosen Indian
        // cities. The field itself shipped with v16, but this backfill was
        // first written inside the `< 16` block while `version` was already
        // 16 — so zustand never called `migrate` for any install at v16,
        // which is every production user it was meant for. It has to be its
        // own step.
        //
        // Why it matters: an upgrader who had picked a city kept it framed in
        // the PHONE's offset. In the Americas that names the wrong Hindu day
        // outright (the sunrise-active tithi differs on nearly every date),
        // and east of UTC+00 it renders times like "Sunrise 1:09 AM". A fresh
        // install picking the same city got the right answer, so two users
        // with identical settings diverged by install path.
        //
        // Provenance is NOT recoverable from `locationName`: the GPS path
        // also stores a reverse-geocoded city name. The coordinates identify
        // a chosen city exactly: the picker stores `city.lat`/`city.lon`
        // verbatim from `INDIAN_CITIES` (whose rows have never been edited
        // and none of which carries a `timezone`), and its own active-row
        // test is this same 0.01° match. So an exact hit is a chosen Indian
        // city and IST is what the picker would have stored -> backfill it.
        // Any other fix is GPS — in India, or across the border in Nepal
        // (+5:45), Bangladesh/Bhutan (+6:00), Pakistan (+5:00), Myanmar
        // (+6:30) — which deliberately stores NO timezone so the device
        // offset applies; leave it unset. A bounding box cannot draw this
        // line: the earlier 6..37.5°N / 68..97.5°E test stamped IST onto
        // Kathmandu, Dhaka, Lahore, Thimphu and Yangon fixes.
        if (version < 17) {
          const loc = state.userLocation as
            | { lat: number; lon: number; timezone?: string }
            | null
            | undefined;
          if (
            loc &&
            !loc.timezone &&
            INDIAN_CITIES.some(
              (c) => Math.abs(c.lat - loc.lat) < 0.01 && Math.abs(c.lon - loc.lon) < 0.01,
            )
          ) {
            state.userLocation = { ...loc, timezone: 'Asia/Kolkata' };
          }
        }

        return state as AppStore;
      },
    }
  )
);
