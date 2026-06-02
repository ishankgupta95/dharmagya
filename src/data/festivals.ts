/**
 * App-wide festival catalogue — sourced from panchang-ts's bundled, pre-computed
 * festival table (`panchang-ts/festivals`). The library is the single source of
 * truth; this module replaces the previously repo-generated
 * `src/data/static/festivals.json` + `scripts/generate-festivals.js` +
 * `festival-overrides.json` (all removed).
 *
 * Shape is intentionally identical to the old JSON — a year-keyed map of
 * `{ date: 'YYYY-MM-DD', festivals: [{ name, type, description? }] }` rows in
 * ENGLISH — so every existing consumer (calendarService, vrat, navratri,
 * reminderScheduler, the festivals screen) works unchanged.
 *
 * Why English: several consumers run name-keyed heuristics over this data
 * (calendarService HEADLINE_MAJORS / deity matchers, vrat-type map, Navratri
 * Day-1 lookup, reminder tithi matchers). The bundled table also ships Hindi,
 * but Hindi rendering stays at the UI boundary via `localizeFestivalName` /
 * `localizeFestivalDescription` so the matching logic has a stable key set.
 *
 * Coverage + caveats (inherited from the bundled table):
 *   - Reference location Varanasi / IST. Within India these dates are
 *     essentially universal; elsewhere a festival can shift ±1 day.
 *   - Year range is {@link FESTIVALS_MIN_YEAR}..{@link FESTIVALS_MAX_YEAR}
 *     (a rolling −2 / +5 window). Years outside the range resolve to `[]`.
 *   - Eclipses are EXCLUDED (visibility is location-dependent). They are
 *     sourced live via `getUpcomingEclipses` in panchangService (daily view /
 *     festivals screen) and calendarService (month grid).
 */
import {
  getFestivalsForYear,
  FESTIVALS_YEAR_RANGE,
  type FestivalTableDay,
} from 'panchang-ts/festivals';

export const FESTIVALS_MIN_YEAR = FESTIVALS_YEAR_RANGE.start;
export const FESTIVALS_MAX_YEAR = FESTIVALS_YEAR_RANGE.end;

/** Year-keyed festival rows in English. Built once at module load (engine-free
 *  lookups against the package's bundled JSON — no panchang computation). */
const festivalsByYear: Record<string, FestivalTableDay[]> = (() => {
  const out: Record<string, FestivalTableDay[]> = {};
  for (let year = FESTIVALS_MIN_YEAR; year <= FESTIVALS_MAX_YEAR; year++) {
    const rows = getFestivalsForYear(year, 'en');
    if (rows) out[String(year)] = rows;
  }
  return out;
})();

export default festivalsByYear;
