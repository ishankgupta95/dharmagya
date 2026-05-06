import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { AyanamsaType, FestivalRegion, Language } from 'panchang-ts';

import {
  FALLBACK_COORDS,
  getCachedPanchangDay,
  getCachedGrahaPositions,
} from '@/services/astrology/panchangService';
import type { IPanchangDay } from '@/types';

interface UseLazyDailyPanchangResult {
  panchang: IPanchangDay | null;
  /** True once end-times (pass 2) have been computed. */
  isFullyLoaded: boolean;
  loading: boolean;
  error: boolean;
  /** True once the user has expressed interest by expanding any category — the
   *  hook only fires daily compute past this point. */
  requested: boolean;
  /** Trigger compute for the current date. Idempotent — subsequent calls are
   *  no-ops, and the hook auto-refetches on date / location / option changes
   *  once requested for the session. */
  request: () => void;
  retry: () => void;
}

/**
 * Lazy variant of `usePanchang`. The full daily-panchang fetch (~5ms on Pixel
 * 3a, computes all muhurtas / time-quality slots / planetary positions) does
 * not fire on day-tap — only after `request()` is called. This honors the
 * panchang screen's "categorise + expand on demand" UX, where the glance
 * section reads from the cheap `CalendarDay` snapshot and each accordion
 * triggers `request()` on first expand.
 *
 * Once requested, the hook tracks `date` / `location` / option changes and
 * refetches automatically — so a user who has expanded "Auspicious Times" and
 * then navigates to a different day still sees the (newly fetched) data
 * without re-tapping.
 */
export function useLazyDailyPanchang(
  date: Date,
  location: { lat: number; lon: number } | null,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  janmaNakshatra?: number,
  janmaRashi?: number,
  ayanamsa: AyanamsaType = 'lahiri',
): UseLazyDailyPanchangResult {
  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount(c => c + 1), []);
  const request = useCallback(() => setRequested(true), []);

  const lat = location?.lat ?? FALLBACK_COORDS.lat;
  const lon = location?.lon ?? FALLBACK_COORDS.lon;

  useEffect(() => {
    if (!requested) {
      // Pre-request: nothing to do. Don't even reset state — that would cause
      // a flash of empty content if the user keeps an accordion open while
      // navigating dates. The fetch effect below handles the date-change case
      // when requested === true.
      return;
    }
    let cancelled = false;
    setError(false);
    setLoading(true);
    setIsFullyLoaded(false);

    const coords = { lat, lon };

    // ── Pass 1: fast path (or cache hit) ──────────────────────────────────────
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
        // Keep the fast pass — end times just won't appear.
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [requested, date, lat, lon, language, region, janmaNakshatra, janmaRashi, ayanamsa, retryCount]);

  return { panchang, isFullyLoaded, loading, error, requested, request, retry };
}
