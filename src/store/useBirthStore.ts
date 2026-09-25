import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';
import type { AyanamsaType } from 'panchang-ts';

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
  /** ISO string in *birthplace* local time (e.g. "1995-08-15T05:30"). Stored
   *  without offset so display is timezone-stable; the compute path converts
   *  it to UTC using `place.timezone`. */
  dateTimeIso: string;
  place: { lat: number; lon: number; name: string; timezone: string };
  /** Cached derived fields — lazily filled on first kundli/match access. */
  derived?: {
    moonRashi: number;       // 0..11
    moonNakshatra: number;   // 0..26
    lagnaRashi: number;      // 0..11
    /** Moon's navamsa (D9) rashi, 0..11. Added in panchang-ts 4.1 surface for
     *  the opt-in Bhakoot navamsa-lord cancellation. Old cached entries
     *  without this field force a recompute on next access (see match.tsx). */
    navamsaRashi?: number;
    /** Ayanamsa the cached values were computed under. Every field in this
     *  block is ayanamsa-dependent (~11% of births change moon rashi or
     *  nakshatra between Lahiri and Raman), so a block computed under a
     *  different setting is a cache MISS, not a hit — otherwise a match
     *  scored the user's freshly-recomputed Moon against a partner's frozen
     *  one. Optional so entries persisted before this field existed also
     *  invalidate themselves, exactly as `navamsaRashi` does above. */
    ayanamsa?: AyanamsaType;
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
    (set, get) => ({
      charts: [],

      // The no-op guards below bail out BEFORE `set` rather than returning `{}`
      // from it: an empty patch still allocates a new state object, notifies
      // every subscriber and triggers a full persist write.
      upsertChart: (entry) => {
        const { charts } = get();
        const idx = charts.findIndex((c) => c.id === entry.id);
        if (idx < 0) {
          // At capacity and this is a new id — the old code returned `{}` here.
          if (charts.length >= MAX_SECONDARY_CHARTS) return;
          set({ charts: [...charts, entry] });
          return;
        }
        const existing = charts[idx];
        // Deliberately NOT guarded on "entry is value-equal to existing": this
        // is the user's own saved birth data, arriving as a freshly-built
        // object from the editor, so an equality check would have to enumerate
        // every field of BirthChartEntry and a single missed field silently
        // discards an edit the user believes they saved. The call fires once
        // per explicit save (a cold path), so the render it costs is not worth
        // that failure mode. See setDerived for the case where a guard IS safe.
        //
        // Drop cached derived if inputs changed.
        const inputsChanged =
          existing.dateTimeIso !== entry.dateTimeIso ||
          existing.place.lat !== entry.place.lat ||
          existing.place.lon !== entry.place.lon;
        const next = [...charts];
        next[idx] = inputsChanged ? { ...entry, derived: undefined } : entry;
        set({ charts: next });
      },

      removeChart: (id) =>
        set((s) => ({ charts: s.charts.filter((c) => c.id !== id) })),

      setDerived: (id, derived) => {
        const { charts } = get();
        const idx = charts.findIndex((c) => c.id === id);
        // Unknown id — the old code returned `{}` here.
        if (idx < 0) return;
        // Unlike upsertChart, `derived` is a pure cache of computed scalars,
        // and every field of the block is compared below, so keeping this list
        // in sync with the `derived` type is mandatory — but the cost of
        // getting it wrong is one redundant recompute on the next open, not a
        // lost user edit. Worth guarding because match.tsx persists this from
        // an effect keyed on the chart object, so each write re-creates that
        // object and re-arms the effect.
        const cached = charts[idx].derived;
        if (
          cached
          && cached.moonRashi === derived.moonRashi
          && cached.moonNakshatra === derived.moonNakshatra
          && cached.lagnaRashi === derived.lagnaRashi
          && cached.navamsaRashi === derived.navamsaRashi
          && cached.ayanamsa === derived.ayanamsa
        ) {
          return;
        }
        const next = [...charts];
        next[idx] = { ...charts[idx], derived };
        set({ charts: next });
      },
    }),
    {
      name: 'dharmagya-birth-charts',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as { charts?: BirthChartEntry[] } | null;
        if (!state?.charts) return persistedState as { charts: BirthChartEntry[] };

        // v1 → v2: `sex` became required. Drop entries that lack it — the
        // Ashtakoot result is meaningless without it, and asking the user to
        // edit each one introduces a worse migration UX than starting clean.
        if (version < 2) {
          state.charts = state.charts.filter((c) => c.sex === 'male' || c.sex === 'female');
        }

        // v2 → v3: place gained a `timezone` field; the date+time stored on
        // each chart was previously interpreted in the device tz, not the
        // birthplace tz. Backfill Asia/Kolkata for the curated India city list
        // and drop the cached `derived` (it was computed against the wrong
        // UTC instant on any non-IST device).
        if (version < 3) {
          state.charts = state.charts.map((c) => {
            const place = c.place as { lat: number; lon: number; name: string; timezone?: string };
            return {
              ...c,
              place: { ...place, timezone: place.timezone ?? 'Asia/Kolkata' },
              derived: undefined,
            };
          });
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
