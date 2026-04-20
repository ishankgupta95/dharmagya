import { InteractionManager } from 'react-native';
import { useEffect, useState } from 'react';
import { getDailyPanchang, type FestivalRegion, type Language } from 'panchang-ts';

import { FALLBACK_COORDS } from './panchangService';

// Devanāgarī tithi abbreviations (from design study, [design/redesign-preview.html]).
// Keyed by 1-based tithi number across both pakshas (1–15 Shukla, 16–30 Krishna).
const TITHI_ABBR: Record<number, string> = {
  1: 'प्र',  2: 'द्वि', 3: 'तृ',  4: 'च',   5: 'पं',  6: 'ष',   7: 'स',
  8: 'अ',   9: 'न',   10: 'द',  11: 'ए',  12: 'द्वा', 13: 'त्र', 14: 'च',
  15: 'पू',
  16: 'प्र', 17: 'द्वि', 18: 'तृ', 19: 'च',  20: 'पं', 21: 'ष',  22: 'स',
  23: 'अ',  24: 'न',  25: 'द',  26: 'ए',  27: 'द्वा', 28: 'त्र', 29: 'च',
  30: 'अमा',
};

export interface CalendarDayInfo {
  tithiAbbr: string;
  hasFestival: boolean;
}

export type CalendarMonthMap = Map<string, CalendarDayInfo>;

export function calendarDayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

/**
 * Computes tithi abbreviation + festival flag for every day in a given month,
 * deferred via InteractionManager so the calendar grid paints first.
 *
 * Each call to `getDailyPanchang(computeEndTimes:false)` is the fast pass used
 * by [usePanchang](../../hooks/usePanchang.ts); ~60-100ms on budget Android, so
 * a full month batch (~30-31 cells) is kept off the interaction frame.
 */
export function useCalendarMonth(
  year: number,
  month: number,
  location: { lat: number; lon: number } | null,
  language: Language,
  region: FestivalRegion,
): CalendarMonthMap {
  const [data, setData] = useState<CalendarMonthMap>(new Map());

  useEffect(() => {
    let cancelled = false;
    const timezone = -new Date().getTimezoneOffset();
    const lat = location?.lat ?? FALLBACK_COORDS.lat;
    const lon = location?.lon ?? FALLBACK_COORDS.lon;
    const loc = { latitude: lat, longitude: lon };

    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const map: CalendarMonthMap = new Map();
      for (let d = 1; d <= daysInMonth; d++) {
        if (cancelled) return;
        const date = new Date(year, month, d, 12, 0, 0);
        try {
          const p = getDailyPanchang(date, loc, {
            timezone,
            computeEndTimes: false,
            language,
            region,
          });
          if (!p) continue;
          const tithiNumber = p.tithis[0]?.index !== undefined
            ? p.tithis[0].index + 1
            : 0;
          map.set(calendarDayKey(year, month, d), {
            tithiAbbr: TITHI_ABBR[tithiNumber] ?? '',
            hasFestival: (p.festivals?.length ?? 0) > 0,
          });
        } catch {
          // Skip failed cells; calendar simply won't show a sub-label for them.
        }
      }
      if (!cancelled) setData(map);
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [year, month, location?.lat, location?.lon, language, region]);

  return data;
}
