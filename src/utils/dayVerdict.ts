import type { IPanchangDay } from '@/types';

export interface DayVerdict {
  text: string;
  /** When true the verdict is a caution (eclipse) and renders in the error tone. */
  caution: boolean;
}

// P16.3 content gate: the "today's verdict" copy is conservative + descriptive
// (it only restates windows panchang-ts already flags, plus an eclipse caution
// — no predictive "good day for X" claims). It carries a provisional posture
// until the en+hi wording passes a qualified-reviewer pass before the bundle
// ships. Flip to false only after that review. Lives here, next to the copy it
// gates, so every surface rendering a verdict shows the same caption.
export const VERDICT_REVIEW_PENDING = true;

/**
 * P16.3 plain-language "today's verdict" — shared by the Panchang tab and the
 * Home Panchang hero (P16.4) so the two never drift.
 *
 * CONSERVATIVE + DESCRIPTIVE only (content gate, see `VERDICT_REVIEW_PENDING`
 * above): it restates *only* windows panchang-ts already flags — an eclipse
 * caution, or the day's best (Abhijit) / avoid (Rahu Kalam) windows. No
 * predictive "good day for X" claims.
 *
 * `eclipsePresent` stays a separate parameter rather than being read off
 * `panchang` so every surface can be pinned to one eclipse source. Both callers
 * now pass `!!panchang?.eclipse`: the calendar-cell snapshot buckets an eclipse
 * by its device-local peak date while the daily compute attributes it to the
 * Hindu (sunrise-to-sunrise) day, so a pre-dawn peak lands the two a day apart.
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
