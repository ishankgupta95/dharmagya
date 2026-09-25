/**
 * Purnima / Amavasya observance days, read out of the pre-computed table
 * `src/data/static/moon-phases-table.json` that
 * `scripts/generate-moon-phases-table.js` builds.
 *
 * These are the days whose SUNRISE tithi is Purnima or Amavasya — the vrat
 * day — not the astronomical syzygy instant, which lands on a different
 * calendar day whenever it falls near local midnight. Reference location is
 * Ujjain / IST, matching the festival table; within India these are
 * essentially universal, elsewhere a day can shift by one.
 *
 * The festival table has no generic monthly Purnima / Amavasya row, which is
 * why this exists: name-matching that table gave the "~12/year" reminders
 * roughly 4 and 2 hits a year.
 */
import table from './static/moon-phases-table.json';

interface MoonPhasesTable {
  _meta: { startYear: number; endYear: number; panchangTsVersion: string };
  years: Record<string, { full: string[]; new: string[] }>;
}

const MOON_PHASES = table as MoonPhasesTable;

export const MOON_PHASES_MIN_YEAR = MOON_PHASES._meta.startYear;
export const MOON_PHASES_MAX_YEAR = MOON_PHASES._meta.endYear;

/** `YYYY-MM-DD` observance days in `year`, or `[]` outside the table's range. */
export function moonPhaseDaysForYear(year: number, phase: 'full' | 'new'): string[] {
  return MOON_PHASES.years[String(year)]?.[phase] ?? [];
}
