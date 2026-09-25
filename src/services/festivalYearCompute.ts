/**
 * On-device festival computation for ONE civil year — the out-of-range half of
 * the festival catalogue.
 *
 * `src/data/static/festivals-table.json` covers a fixed window (2020–2050, see
 * `scripts/generate-festivals-table.js`). A year outside it is computed here,
 * once, and cached in SQLite by `./festivalYearCache`. The output must be
 * INDISTINGUISHABLE from the table's own rows for that year — every consumer
 * treats the two as the same data — so this reproduces the library's
 * `buildFestivalsTable` year build step for step:
 *
 *   - the same per-day engine call: `computeFestivalsInRange` over the UTC
 *     midnights `Date.UTC(year, 0, 1)` … `Date.UTC(year, 11, 31)`, with the
 *     table's own location / offset / ayanamsa / masa system / region;
 *   - the same filtering: `type === 'eclipse'` rows dropped (their visibility is
 *     location-dependent; the app sources them live);
 *   - the same bucketing: by `toDateKey(date, offset)`, dates sorted, entries in
 *     emission order within a date;
 *   - the same decoded entry shape `readFestivalsForYear(table, year, 'en')`
 *     produces: `{ key, name, type, description? }`.
 *
 * Why not just call `buildFestivalsTable({ startYear: year, endYear: year })`?
 * It is one synchronous call: ~0.2 s for a year under V8 with its JIT, ~2.5 s on
 * the same desktop-class machine with the JIT off (`node --jitless`, the closer
 * model for Hermes, which has none), and slower again on a low-end phone — a
 * frozen JS thread with no way to show progress or stop.
 * `computeFestivalsInRange` is a plain per-day loop with no cross-day state, so
 * running it one day at a time and yielding whenever a time budget is spent
 * (see {@link DEFAULT_SLICE_BUDGET_MS}) gives the byte-identical result with the
 * event loop serviced in between. That parity is not taken on trust:
 * `scripts/check-generated-data.js` transpiles THIS file and diffs its output
 * against `buildFestivalsTable` for a year outside the table (one run sliced
 * per day, others on the default budget), so an engine bump that changes the
 * build step fails CI rather than quietly forking the two paths.
 *
 * Deliberately free of React Native / expo imports — only `panchang-ts` — so
 * that check can load it under plain Node.
 */
import {
  computeFestivalsInRange,
  type AyanamsaType,
  type FestivalRegion,
  type MasaSystem,
} from 'panchang-ts';
import type { FestivalTableDay, FestivalTableEntry } from 'panchang-ts/festivals';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The parameters a festival year is computed under — the table's `_meta`. */
export interface FestivalYearComputeParams {
  latitude: number;
  longitude: number;
  /** Minutes east of UTC; the table is bucketed into civil dates in this offset. */
  timezoneOffsetMinutes: number;
  ayanamsa: AyanamsaType;
  masaSystem: MasaSystem;
  region: FestivalRegion;
}

/** Work already done on a year: how many iteration days, and their rows. */
export interface FestivalYearPartial {
  /** Iteration days evaluated so far, `0..festivalYearTotalDays(year)`. */
  daysDone: number;
  days: FestivalTableDay[];
}

export interface FestivalYearComputeResult extends FestivalYearPartial {
  /** `false` when `signal` stopped the run early; `days` then holds what was done. */
  complete: boolean;
  totalDays: number;
}

export interface FestivalYearComputeOptions {
  /** Checked between slices; an abort returns the partial result, never throws. */
  signal?: AbortSignal;
  /** Resume from a previous partial run of the SAME year and params. */
  resume?: FestivalYearPartial | null;
  /** Called at the end of every slice (before each yield, and once at the end)
   *  with the rows so far (sorted, same shape as the final result). */
  onChunk?: (partial: FestivalYearPartial, totalDays: number) => void;
  /** How long one slice may hold the JS thread before yielding, in ms. Default
   *  {@link DEFAULT_SLICE_BUDGET_MS}; `0` yields after every day. */
  sliceBudgetMs?: number;
}

/**
 * How long one slice of the compute may run before it yields to the event loop.
 *
 * The unit of work is one engine day: one `getDailyPanchang` with only the
 * festival and eclipse sections. Measured for 2051 at the table's reference
 * point on a desktop-class Mac: ~0.6 ms a day under V8 with its JIT (0.23 s a
 * year), but ~6 ms median / ~8 ms p90 a day with the JIT off (`node --jitless`,
 * the odd day ~45 ms, 2.5–2.9 s a year) — and Hermes has no JIT. A low-end Android phone is several
 * times slower again; that figure has NOT been measured on a device yet, so no
 * year-duration promise rests on it.
 *
 * That spread is why the slice is bounded by time, not by a day count: a fixed
 * 8-day chunk was ~4 ms with a JIT and 50–125 ms without one (3–7 dropped
 * frames per chunk even on fast hardware). The loop instead runs whole days
 * while the next one (priced at the last one's cost) still fits in this budget,
 * then yields — many days per slice where a day is cheap, exactly one where it
 * is not. One day is the floor (`computeFestivalsInRange` cannot stop
 * mid-day), so on a slow phone a slice is one engine day long, and an abort
 * lands within one day.
 */
export const DEFAULT_SLICE_BUDGET_MS = 8;

/** Monotonic ms clock: `performance.now()` where the runtime has it (Hermes in
 *  React Native and Node both do), wall-clock ms otherwise. */
const now: () => number =
  typeof performance === 'object' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

/**
 * How many engine days a year's build iterates: the UTC midnights from
 * 1 January to 31 December inclusive, i.e. 365 or 366. This is the unit of
 * progress and of resume, NOT a count of civil dates (a negative table offset
 * would bucket the first iteration into 31 December of the previous year).
 */
export function festivalYearTotalDays(year: number): number {
  return Math.round((Date.UTC(year, 11, 31) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
}

/** `buildFestivalsTable`'s date key: the civil date of `d` in the table offset. */
function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sortedDays(byDate: Map<string, FestivalTableEntry[]>): FestivalTableDay[] {
  return [...byDate.keys()].sort().map(date => ({ date, festivals: [...(byDate.get(date) ?? [])] }));
}

function yieldToEventLoop(): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

/**
 * Compute `year`'s festival rows in time-boxed slices of whole days, yielding
 * to the event loop between them. Resolves with `complete: false` (and the
 * partial rows) if `signal` aborts; rejects only if the engine itself throws.
 */
export async function computeFestivalYear(
  year: number,
  params: FestivalYearComputeParams,
  opts: FestivalYearComputeOptions = {},
): Promise<FestivalYearComputeResult> {
  if (!Number.isInteger(year)) throw new RangeError(`year must be an integer, got ${year}`);
  const totalDays = festivalYearTotalDays(year);
  const budgetMs = Math.max(0, opts.sliceBudgetMs ?? DEFAULT_SLICE_BUDGET_MS);
  const location = { latitude: params.latitude, longitude: params.longitude };
  const engineOptions = {
    timezone: params.timezoneOffsetMinutes,
    ayanamsa: params.ayanamsa,
    masaSystem: params.masaSystem,
    region: params.region,
    language: 'en' as const,
  };

  // Seeded from the resume rows IN ORDER, so a date split across the resume
  // boundary (impossible at a positive offset, but not at a negative one) keeps
  // its emission order exactly as one uninterrupted run would have.
  const byDate = new Map<string, FestivalTableEntry[]>();
  const resume = opts.resume;
  let daysDone = 0;
  if (resume && resume.daysDone > 0 && resume.daysDone <= totalDays) {
    for (const day of resume.days) byDate.set(day.date, [...day.festivals]);
    daysDone = resume.daysDone;
  }

  const firstDayMs = Date.UTC(year, 0, 1);
  while (daysDone < totalDays) {
    if (opts.signal?.aborted) {
      return { complete: false, daysDone, totalDays, days: sortedDays(byDate) };
    }
    // One slice: whole engine days, at least one, and another only while the
    // last day's cost still fits in what is left of the budget — so a slice
    // ends BEFORE it overruns rather than one day after. Each day is its own
    // single-day engine call: the engine loop carries no state from one day to
    // the next, so this is the same emission sequence one call over the whole
    // range would give.
    const sliceStart = now();
    let dayStart = sliceStart;
    let dayMs = 0;
    do {
      const day = new Date(firstDayMs + daysDone * DAY_MS);
      for (const emission of computeFestivalsInRange(day, day, location, engineOptions)) {
        const f = emission.festival;
        if (f.type === 'eclipse') continue;
        const entry: FestivalTableEntry = { key: f.key, name: f.name, type: f.type };
        if (f.description) entry.description = f.description;
        const dateKey = toDateKey(emission.date, params.timezoneOffsetMinutes);
        const bucket = byDate.get(dateKey);
        if (bucket) bucket.push(entry);
        else byDate.set(dateKey, [entry]);
      }
      daysDone += 1;
      const dayEnd = now();
      dayMs = dayEnd - dayStart;
      dayStart = dayEnd;
    } while (daysDone < totalDays && dayStart - sliceStart + dayMs <= budgetMs);
    if (opts.onChunk) opts.onChunk({ daysDone, days: sortedDays(byDate) }, totalDays);
    if (daysDone < totalDays) await yieldToEventLoop();
  }
  return { complete: true, daysDone, totalDays, days: sortedDays(byDate) };
}
