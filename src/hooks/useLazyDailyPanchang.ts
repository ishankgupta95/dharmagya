import { useCallback, useEffect, useState } from 'react';
import type { AyanamsaType, FestivalRegion, Language } from 'panchang-ts';

import {
  FALLBACK_COORDS,
  getCachedPanchangDay,
  type PanchangCoords,
} from '@/services/astrology/panchangService';
import type { IPanchangDay } from '@/types';

interface UseLazyDailyPanchangResult {
  panchang: IPanchangDay | null;
  /** True once the daily panchang has rendered (kept for API parity with
   *  callers that previously distinguished fast/full passes). */
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
 * Lazy daily-panchang hook. The full daily-panchang fetch (~5ms on Pixel 3a,
 * computes all muhurtas / time-quality slots / planetary positions) does not
 * fire on day-tap — only after `request()` is called. This honors the
 * panchang screen's "categorise + expand on demand" UX, where the glance
 * section reads from the cheap `CalendarDay` snapshot and each accordion
 * triggers `request()` on first expand.
 *
 * Once requested, the hook tracks `date` / `location` / option changes and
 * refetches automatically — so a user who has expanded "Auspicious Times" and
 * then navigates to a different day still sees the (newly fetched) data
 * without re-tapping.
 *
 * The fetch is a single full-pass (`computeEndTimes: true`). An earlier two-
 * pass design (fast + full) was dropped in P11.1 because the fast pass barely
 * beat full (~301ms vs ~312ms on Pixel 4 emulator) and on cache-miss it
 * doubled the work without changing perceived latency.
 */
export function useLazyDailyPanchang(
  date: Date,
  location: PanchangCoords | null,
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
  // A chosen place carries its own zone; a GPS fix does not (the device is
  // standing there). Falling back to FALLBACK_COORDS pulls in Ujjain/IST.
  const tz = location ? location.timezone : FALLBACK_COORDS.timezone;

  useEffect(() => {
    if (!requested) {
      // Pre-request: nothing to do. Don't even reset state — that would cause
      // a flash of empty content if the user keeps an accordion open while
      // navigating dates. The fetch effect below handles the date-change case
      // when requested === true.
      return;
    }
    // The compute is synchronous (a cache lookup; ~5ms on a Pixel 3a on a
    // miss), so the "started" flags and the "done" flags have always landed in
    // one batched render: `loading` has never been observable as true and is
    // kept for API parity only. The work runs in a microtask rather than the
    // effect body — a synchronous setState here is a cascading render (and the
    // compiler's set-state-in-effect rule), while a microtask completes in the
    // same tick, before the next frame — so what consumers observe per commit
    // is unchanged: the previous panchang for the frame of the date change,
    // then the new one. `cancelled` drops a compute whose inputs changed (or
    // whose owner unmounted) before the microtask ran.
    let cancelled = false;
    const coords: PanchangCoords = { lat, lon, timezone: tz };
    queueMicrotask(() => {
      if (cancelled) return;
      let full: IPanchangDay | null;
      try {
        full = getCachedPanchangDay(date, coords, {
          computeEndTimes: true, language, region, janmaNakshatra, janmaRashi, ayanamsa,
        });
      } catch {
        full = null;
      }
      if (!full) {
        setError(true);
        setIsFullyLoaded(false);
        setLoading(false);
        return;
      }
      setPanchang(full);
      setError(false);
      setIsFullyLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [requested, date, lat, lon, tz, language, region, janmaNakshatra, janmaRashi, ayanamsa, retryCount]);

  return { panchang, isFullyLoaded, loading, error, requested, request, retry };
}
