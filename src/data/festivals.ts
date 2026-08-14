/**
 * App-wide festival catalogue — read out of the pre-computed festival table
 * `src/data/static/festivals-table.json`, which
 * `scripts/generate-festivals-table.js` builds from panchang-ts's own
 * `buildFestivalsTable`. The library is still the single source of truth for
 * the dates; only the storage is ours. (4.2.0–4.3.1 bundled the table inside
 * the package and this module needed no local JSON; v5 removed every bundled
 * table, so the generator is back — see the script's header.)
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
 * Coverage + caveats (stamped into the table's `_meta` by the generator):
 *   - Reference location Varanasi / IST. Within India these dates are
 *     essentially universal; elsewhere a festival can shift ±1 day.
 *   - Year range is {@link FESTIVALS_MIN_YEAR}..{@link FESTIVALS_MAX_YEAR}
 *     (a rolling −2 / +5 window fixed at generation time — re-run the script
 *     when it ages out). Years outside the range resolve to `[]`.
 *   - Eclipses are EXCLUDED (visibility is location-dependent). They are
 *     sourced live via `getUpcomingEclipses` in panchangService (daily view /
 *     festivals screen) and calendarService (month grid).
 */
import {
  readFestivalsForYear,
  readFestivalsYearRange,
  type AnyFestivalsFile,
  type FestivalTableDay,
} from 'panchang-ts/festivals';

import table from './static/festivals-table.json';

const FESTIVALS_TABLE = table as unknown as AnyFestivalsFile;
const FESTIVALS_YEAR_RANGE = readFestivalsYearRange(FESTIVALS_TABLE);

export const FESTIVALS_MIN_YEAR = FESTIVALS_YEAR_RANGE.start;
export const FESTIVALS_MAX_YEAR = FESTIVALS_YEAR_RANGE.end;

/** Year-keyed festival rows in English. Built once at module load — the reader
 *  is engine-free (~2 KB), so this is a dictionary decode, not a panchang
 *  computation. */
const festivalsByYear: Record<string, FestivalTableDay[]> = (() => {
  const out: Record<string, FestivalTableDay[]> = {};
  for (let year = FESTIVALS_MIN_YEAR; year <= FESTIVALS_MAX_YEAR; year++) {
    const rows = readFestivalsForYear(FESTIVALS_TABLE, year, 'en');
    if (rows) out[String(year)] = rows;
  }
  return out;
})();

export default festivalsByYear;
