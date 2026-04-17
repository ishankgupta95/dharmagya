import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

import type { AppLanguage } from '@/i18n';
import type { RashiSign } from '@/types';

export type FontSize = 'small' | 'normal' | 'large' | 'xl';
export type MasaSystem = 'purnimanta' | 'amanta';

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
  isDarkMode: boolean;
  favoriteIds: string[]; // Stores both aarti and chalisa IDs (prefixed: "aarti-*", "chalisa-*")
  hasOnboarded: boolean;
  selectedDeities: string[];
  userLocation: { lat: number; lon: number } | null;
  locationName: string | null; // e.g. "Mumbai, MH" or "GPS"
  fontSize: FontSize;
  language: AppLanguage;
  masaSystem: MasaSystem;
  dailyReminderEnabled: boolean;
  sunriseAlertEnabled: boolean;
  reminderPrefs: ReminderPrefs;
  /** ISO YYYY-MM-DD, or null if not set. */
  userBirthDate: string | null;
  /** Manually-selected rashi (fallback when DOB not set). */
  userRashi: RashiSign | null;
  walkthroughStep: number;
  /** Timestamp (ms) of when the user first opened the app. Used for first-session ad grace period. */
  firstOpenTimestamp: number;

  // Actions (not persisted)
  toggleTheme: () => void;
  toggleFavorite: (id: string) => void;
  setUserLocation: (loc: { lat: number; lon: number }, name?: string) => void;
  setHasOnboarded: () => void;
  setSelectedDeities: (deities: string[]) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: AppLanguage) => void;
  setMasaSystem: (system: MasaSystem) => void;
  setDailyReminderEnabled: (val: boolean) => void;
  setSunriseAlertEnabled: (val: boolean) => void;
  setTithiReminder: (key: TithiReminderKey, val: boolean) => void;
  setFestivalReminder: (key: FestivalReminderKey, val: boolean) => void;
  setUserBirthDate: (iso: string | null) => void;
  setUserRashi: (sign: RashiSign | null) => void;
  setWalkthroughStep: (step: number) => void;
  initFirstOpen: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      isDarkMode: true,
      favoriteIds: [],
      hasOnboarded: false,
      selectedDeities: [],
      userLocation: null,
      locationName: null,
      fontSize: 'normal',
      language: 'system' as AppLanguage,
      masaSystem: 'purnimanta' as MasaSystem,
      dailyReminderEnabled: false,
      sunriseAlertEnabled: false,
      reminderPrefs: DEFAULT_REMINDER_PREFS,
      userBirthDate: null,
      userRashi: null,
      walkthroughStep: 1,
      firstOpenTimestamp: 0,

      toggleTheme: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
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
      setDailyReminderEnabled: (val) => set({ dailyReminderEnabled: val }),
      setSunriseAlertEnabled: (val) => set({ sunriseAlertEnabled: val }),
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
      setUserRashi: (sign) => set({ userRashi: sign }),
      setWalkthroughStep: (step) => set({ walkthroughStep: step }),
      initFirstOpen: () => set((s) => s.firstOpenTimestamp ? {} : { firstOpenTimestamp: Date.now() }),
    }),
    {
      name: 'dharmagya-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
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

        return state as AppStore;
      },
    }
  )
);
