import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { AyanamsaType, FestivalRegion, Language } from 'panchang-ts';

import {
  FALLBACK_COORDS,
  getCachedPanchangDay,
  getCachedGrahaPositions,
} from '@/services/astrology/panchangService';
import type { IPanchangDay } from '@/types';

interface UsePanchangResult {
  panchang: IPanchangDay | null;
  /** True once end-times (pass 2) have been computed. */
  isFullyLoaded: boolean;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export function usePanchang(
  date: Date,
  location: { lat: number; lon: number } | null,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  janmaNakshatra?: number,
  janmaRashi?: number,
  ayanamsa: AyanamsaType = 'lahiri',
): UsePanchangResult {
  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  const lat = location?.lat ?? FALLBACK_COORDS.lat;
  const lon = location?.lon ?? FALLBACK_COORDS.lon;

  useEffect(() => {
    let cancelled = false;
    setError(false);

    const coords = { lat, lon };

    // ── Pass 1: fast path (or cache hit) ──────────────────────────────────────
    // A full-pass entry in the cache satisfies this fast request too, so a
    // warm cache (e.g. populated by home) means no sync compute at all.
    let fast: IPanchangDay | null;
    try {
      fast = getCachedPanchangDay(date, coords, { computeEndTimes: false, language, region, janmaNakshatra, janmaRashi, ayanamsa });
    } catch {
      setError(true);
      setLoading(false);
      return;
    }
    if (!fast) {
      setError(true);
      setLoading(false);
      return;
    }
    setPanchang(fast);
    setLoading(false);
    // If the cache already carries planetary positions, this *might* be a full
    // entry — but we can't tell from IPanchangDay alone, so let pass 2 confirm.
    setIsFullyLoaded(false);

    // ── Pass 2: full + planetary positions, after interactions ───────────────
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      try {
        const full = getCachedPanchangDay(date, coords, { computeEndTimes: true, language, region, janmaNakshatra, janmaRashi, ayanamsa });
        if (!full) return;
        let positions = full.planetaryPositions;
        if (!positions) {
          try { positions = getCachedGrahaPositions(date, language, ayanamsa); } catch { /* non-critical */ }
        }
        if (positions) full.planetaryPositions = positions;
        if (!cancelled) {
          setPanchang(full);
          setIsFullyLoaded(true);
        }
      } catch {
        // Keep the fast pass — end times just won't appear
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [date, lat, lon, language, region, janmaNakshatra, janmaRashi, ayanamsa, retryCount]);

  return { panchang, isFullyLoaded, loading, error, retry };
}
