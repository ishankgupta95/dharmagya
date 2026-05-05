import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

export type Sex = 'male' | 'female';

/**
 * Persisted secondary charts (spouse, children, parents, friends) used by the
 * Kundli surface and Ashtakoot matching. The user's own chart is sourced from
 * `useStore.userBirth*` — this slice covers everyone else.
 *
 * `sex` is required for Ashtakoot matching, since Varna's "boy ≥ girl" rule
 * is asymmetric. `derived` caches the moon rashi/nakshatra and lagna so
 * re-opening matching / sade-sati screens doesn't trigger a Saturn-arc rescan
 * or a fresh planetary compute every render. Inputs (`dateTimeIso`, `place`)
 * are the source of truth — derived fields are filled lazily on first compute.
 */
export interface BirthChartEntry {
  /** Stable id (uuid-ish; generated client-side). */
  id: string;
  /** Display label — "Spouse", "Mother", or whatever the user types. */
  name: string;
  /** Biological sex; required for Ashtakoot matching to correctly assign the
   *  Vara (boy) and Vadhu (girl) roles per classical convention. */
  sex: Sex;
  /** ISO string in local time (e.g. "1995-08-15T05:30"). Stored without offset
   *  so display is timezone-stable; service applies device offset for compute. */
  dateTimeIso: string;
  place: { lat: number; lon: number; name: string };
  /** Cached derived fields — lazily filled on first kundli/match access. */
  derived?: {
    moonRashi: number;       // 0..11
    moonNakshatra: number;   // 0..26
    lagnaRashi: number;      // 0..11
  };
  /** When the entry was created (ms epoch). Used to sort the picker list. */
  createdAt: number;
}

export const MAX_SECONDARY_CHARTS = 5;

interface BirthStore {
  charts: BirthChartEntry[];

  upsertChart: (entry: BirthChartEntry) => void;
  removeChart: (id: string) => void;
  /** Patch the cached derived fields after a fresh compute. */
  setDerived: (id: string, derived: NonNullable<BirthChartEntry['derived']>) => void;
}

export const useBirthStore = create<BirthStore>()(
  persist(
    (set) => ({
      charts: [],

      upsertChart: (entry) =>
        set((s) => {
          const idx = s.charts.findIndex((c) => c.id === entry.id);
          if (idx >= 0) {
            const existing = s.charts[idx];
            // Drop cached derived if inputs changed.
            const inputsChanged =
              existing.dateTimeIso !== entry.dateTimeIso ||
              existing.place.lat !== entry.place.lat ||
              existing.place.lon !== entry.place.lon;
            const next = [...s.charts];
            next[idx] = inputsChanged ? { ...entry, derived: undefined } : entry;
            return { charts: next };
          }
          if (s.charts.length >= MAX_SECONDARY_CHARTS) return {};
          return { charts: [...s.charts, entry] };
        }),

      removeChart: (id) =>
        set((s) => ({ charts: s.charts.filter((c) => c.id !== id) })),

      setDerived: (id, derived) =>
        set((s) => {
          const idx = s.charts.findIndex((c) => c.id === id);
          if (idx < 0) return {};
          const next = [...s.charts];
          next[idx] = { ...next[idx], derived };
          return { charts: next };
        }),
    }),
    {
      name: 'dharmagya-birth-charts',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as { charts?: BirthChartEntry[] } | null;
        if (!state?.charts) return persistedState as { charts: BirthChartEntry[] };

        // v1 → v2: `sex` became required. Drop entries that lack it — the
        // Ashtakoot result is meaningless without it, and asking the user to
        // edit each one introduces a worse migration UX than starting clean.
        if (version < 2) {
          state.charts = state.charts.filter((c) => c.sex === 'male' || c.sex === 'female');
        }

        return state as { charts: BirthChartEntry[] };
      },
    },
  ),
);

/** Generate a short opaque id for a new chart entry. No crypto needed — only
 *  uniqueness within a single device's <=5 entries is required. */
export function newChartId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
