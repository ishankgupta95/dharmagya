import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

import type { AppLanguage } from '@/i18n';

export type FontSize = 'small' | 'normal' | 'large' | 'xl';
export type MasaSystem = 'purnimanta' | 'amanta';

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
      setWalkthroughStep: (step) => set({ walkthroughStep: step }),
      initFirstOpen: () => set((s) => s.firstOpenTimestamp ? {} : { firstOpenTimestamp: Date.now() }),
    }),
    {
      name: 'dharmagya-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
