import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';
import type { AyanamsaType } from 'panchang-ts';

import type { AppLanguage } from '@/i18n';

export type FontSize = 'small' | 'normal' | 'medium' | 'large' | 'xl' | 'xxl';
export type MasaSystem = 'purnimanta' | 'amanta';
export type TimeFormat = 'auto' | '12h' | '24h';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Ayanamsa = AyanamsaType;
export type ChartStyle = 'north' | 'south';
export type HouseSystem = 'whole-sign' | 'equal' | 'placidus-kp';
export type Sex = 'male' | 'female';

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
 *  3  = Library → explain the screen (tap Next → go to Home)
 *  4  = Home → highlight settings gear (tap → finish)
 */
interface AppStore {
  // Persisted
  /** User preference. 'system' follows the OS color scheme. */
  themeMode: ThemeMode;
  /** Resolved boolean ('themeMode' + system scheme). Synced at runtime in
   *  _layout.tsx; persisted so first paint matches the last known value. */
  isDarkMode: boolean;
  favoriteIds: string[]; // Stores both aarti and chalisa IDs (prefixed: "aarti-*", "chalisa-*")
  hasOnboarded: boolean;
  selectedDeities: string[];
  userLocation: { lat: number; lon: number } | null;
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

  // Actions (not persisted)
  setThemeMode: (mode: ThemeMode) => void;
  /** Internal: called by _layout.tsx whenever themeMode or system scheme changes. */
  setResolvedDarkMode: (val: boolean) => void;
  toggleFavorite: (id: string) => void;
  setUserLocation: (loc: { lat: number; lon: number }, name?: string) => void;
  setHasOnboarded: () => void;
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
  setUserBirthDate: (iso: string | null) => void;
  setUserBirthTime: (hhmm: string | null) => void;
  setUserBirthPlace: (place: { lat: number; lon: number; name: string; timezone: string } | null) => void;
  setUserSex: (sex: Sex | null) => void;
  setUserName: (name: string | null) => void;
  setWalkthroughStep: (step: number) => void;
  initFirstOpen: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      themeMode: 'system' as ThemeMode,
      isDarkMode: true,
      favoriteIds: [],
      hasOnboarded: false,
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
      userBirthDate: null,
      userBirthTime: null,
      userBirthPlace: null,
      userSex: null,
      userName: null,
      walkthroughStep: 1,
      firstOpenTimestamp: 0,

      setThemeMode: (mode) => set({ themeMode: mode }),
      setResolvedDarkMode: (val) => set((s) => (s.isDarkMode === val ? {} : { isDarkMode: val })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((fId) => fId !== id)
            : [...s.favoriteIds, id],
        })),
      setUserLocation: (loc, name) => set({ userLocation: loc, locationName: name ?? null }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
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
      initFirstOpen: () => set((s) => s.firstOpenTimestamp ? {} : { firstOpenTimestamp: Date.now() }),
    }),
    {
      name: 'dharmagya-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 11,
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
        // 'large' (1.5) is now 'xl', and old 'xl' (1.9) is closest to new 'xxl' (1.75).
        if (version < 5) {
          const f = state.fontSize as string | undefined;
          if (f === 'large') state.fontSize = 'xl';
          else if (f === 'xl') state.fontSize = 'xxl';
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

        return state as AppStore;
      },
    }
  )
);
