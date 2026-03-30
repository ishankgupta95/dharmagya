import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { getDailyPanchang } from 'panchang-ts';

import {
  FALLBACK_COORDS,
  mapToPanchangDay,
  fetchGrahaPositions,
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
    setLoading(true);
    setError(false);
    setIsFullyLoaded(false);

    const timezone = -new Date().getTimezoneOffset();
    const loc = { latitude: lat, longitude: lon };

    // ── Pass 1: Fast — names only (~60–100ms on budget Android) ──────────────
    try {
      const fast = getDailyPanchang(date, loc, { timezone, computeEndTimes: false });
      if (!cancelled) {
        setPanchang(mapToPanchangDay(fast));
        setLoading(false);
      }
    } catch {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
      return;
    }

    // ── Pass 2: Full — end-times + planetary positions after interactions ────
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      try {
        const full = getDailyPanchang(date, loc, { timezone, computeEndTimes: true });
        if (!cancelled) {
          const mapped = mapToPanchangDay(full);
          // Planetary positions are computed separately (CPU-heavy)
          try {
            mapped.planetaryPositions = fetchGrahaPositions(date);
          } catch {
            // Non-critical — positions just won't appear
          }
          setPanchang(mapped);
          setIsFullyLoaded(true);
        }
      } catch {
        // Keep the fast pass result — end times just won't appear
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [date, lat, lon, retryCount]);

  return { panchang, isFullyLoaded, loading, error, retry };
}
