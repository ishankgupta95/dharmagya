import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

export type FontSize = 'small' | 'normal' | 'large' | 'xl';

export interface CachedFestivalDay {
  /** ISO date string (YYYY-MM-DD) for serialization */
  dateISO: string;
  festivals: Array<{ name: string; type: string }>;
}

interface FestivalCache {
  /** Cache key: "year:lat:lon" */
  key: string;
  days: CachedFestivalDay[];
}

interface AppStore {
  // Persisted
  isDarkMode: boolean;
  favoriteIds: string[]; // Stores both aarti and chalisa IDs (prefixed: "aarti-*", "chalisa-*")
  hasOnboarded: boolean;
  selectedDeities: string[];
  userLocation: { lat: number; lon: number } | null;
  fontSize: FontSize;
  dailyReminderEnabled: boolean;
  sunriseAlertEnabled: boolean;
  festivalCache: FestivalCache | null;

  // Actions (not persisted)
  toggleTheme: () => void;
  toggleFavorite: (id: string) => void;
  setUserLocation: (loc: { lat: number; lon: number }) => void;
  setHasOnboarded: () => void;
  setSelectedDeities: (deities: string[]) => void;
  setFontSize: (size: FontSize) => void;
  setDailyReminderEnabled: (val: boolean) => void;
  setSunriseAlertEnabled: (val: boolean) => void;
  setFestivalCache: (cache: FestivalCache) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      isDarkMode: true,
      favoriteIds: [],
      hasOnboarded: false,
      selectedDeities: [],
      userLocation: null,
      fontSize: 'normal',
      dailyReminderEnabled: false,
      sunriseAlertEnabled: false,
      festivalCache: null,

      toggleTheme: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((fId) => fId !== id)
            : [...s.favoriteIds, id],
        })),
      setUserLocation: (loc) => set({ userLocation: loc }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      setSelectedDeities: (deities) => set({ selectedDeities: deities }),
      setFontSize: (size) => set({ fontSize: size }),
      setDailyReminderEnabled: (val) => set({ dailyReminderEnabled: val }),
      setSunriseAlertEnabled: (val) => set({ sunriseAlertEnabled: val }),
      setFestivalCache: (cache) => set({ festivalCache: cache }),
    }),
    {
      name: 'dharmsetu-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
