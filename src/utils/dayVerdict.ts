import type { IPanchangDay } from '@/types';

export interface DayVerdict {
  text: string;
  /** When true the verdict is a caution (eclipse) and renders in the error tone. */
  caution: boolean;
}

/**
 * P16.3 plain-language "today's verdict" — shared by the Panchang tab and the
 * Home Panchang hero (P16.4) so the two never drift.
 *
 * CONSERVATIVE + DESCRIPTIVE only (content gate, see `VERDICT_REVIEW_PENDING`
 * in `app/(tabs)/panchang.tsx`): it restates *only* windows panchang-ts already
 * flags — an eclipse caution, or the day's best (Abhijit) / avoid (Rahu Kalam)
 * windows. No predictive "good day for X" claims.
 *
 * `eclipsePresent` is passed in (not read off `panchang`) so callers can use a
 * synchronous source (e.g. the calendar-cell snapshot) before the daily compute
 * resolves.
 */
export function buildDayVerdict(
  panchang: IPanchangDay | null,
  eclipsePresent: boolean,
  t: (k: string, o?: Record<string, unknown>) => string,
): DayVerdict | null {
  if (eclipsePresent) return { text: t('panchang.verdictEclipse'), caution: true };
  if (!panchang) return null;
  const best =
    panchang.abhijitMuhurtaStart && panchang.abhijitMuhurtaEnd
      ? `${panchang.abhijitMuhurtaStart}–${panchang.abhijitMuhurtaEnd}`
      : null;
  const avoid =
    panchang.rahuKalamStart && panchang.rahuKalamEnd
      ? `${panchang.rahuKalamStart}–${panchang.rahuKalamEnd}`
      : null;
  if (best && avoid) return { text: t('panchang.verdictBestAvoid', { best, avoid }), caution: false };
  if (avoid) return { text: t('panchang.verdictAvoidOnly', { avoid }), caution: false };
  if (best) return { text: t('panchang.verdictBestOnly', { best }), caution: false };
  return null;
}
