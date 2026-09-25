/**
 * Festival years OUTSIDE the bundled table — computed on-device once, cached in
 * SQLite, and served to the Festivals browse screen through a tiny external
 * store.
 *
 * WHAT WAS HERE BEFORE. Nothing: `@/data/festivals` resolves an out-of-range
 * year to `[]`, and the Festivals screen's year picker simply stopped at the
 * table's edges. That module still never computes — every other consumer
 * (calendar, reminders, Navratri, vrat labels) stays synchronous and
 * table-only. This service is the one deliberate exception, for the one screen
 * whose job is to browse a year.
 *
 * WHICH YEARS. {@link FESTIVALS_BROWSE_MIN_YEAR}..{@link FESTIVALS_BROWSE_MAX_YEAR}:
 * the table's own range plus {@link FESTIVALS_COMPUTE_WINDOW_YEARS} on each
 * side. The bound is the compute-storm guard — every year past the table costs
 * a full-year engine run the first time — so {@link requestFestivalYear} refuses
 * anything outside it no matter who calls, not just the screen's picker.
 *
 * SAME ANSWER AS THE TABLE. A computed year uses `getFestivalsTableBuild()` — the
 * parameters the table itself was built with, read from its `_meta` — so region
 * `'all'` + Lahiri + purnimanta at Ujjain/IST, exactly like the in-range years,
 * and the user's Region is applied at read time the same way. The compute
 * (`./festivalYearCompute`) reproduces the table's build step and is checked
 * against it by `npm run check:data`.
 *
 * OFF THE RENDER PATH, ONE AT A TIME. Computes run in time-boxed slices of
 * whole days with yields between them, from an effect, never from render. They
 * are serialized through one promise chain, so a request made while another
 * year is computing waits behind it rather than interleaving two engine loops
 * on the JS thread; a request whose `signal` has aborted by the time its turn
 * comes does no work at all. The screen debounces the picker on top of that, so
 * scrubbing past five years starts at most the one it settles on.
 *
 * STREAMING, PROGRESS, STOP / RESUME. The per-year state carries the rows
 * computed so far and a day count, published at most every
 * {@link PROGRESS_PUBLISH_MS}. An abort (the user stops it, or moves to another
 * year, or leaves the screen) keeps the partial rows in memory AND in the row's
 * `days_done`, so the next request — this session or a later one — resumes
 * rather than restarting.
 *
 * THE CACHE ROW (`festival_year_cache`, database.ts rung 13) is keyed by year +
 * region + ayanamsa + masa system + engine version + reference point; see the
 * DDL's comment. Dead rows (another engine, another reference, or a year a
 * regenerated table has since absorbed) are pruned once per session.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { FestivalTableDay } from 'panchang-ts/festivals';

import {
  FESTIVALS_MAX_YEAR,
  FESTIVALS_MIN_YEAR,
  getFestivalsTableBuild,
  isFestivalYearInTable,
} from '@/data/festivals';
import {
  computeFestivalYear,
  festivalYearTotalDays,
  type FestivalYearComputeParams,
  type FestivalYearPartial,
} from './festivalYearCompute';

/** Years computed on-device past each edge of the bundled table. */
export const FESTIVALS_COMPUTE_WINDOW_YEARS = 5;
export const FESTIVALS_BROWSE_MIN_YEAR = FESTIVALS_MIN_YEAR - FESTIVALS_COMPUTE_WINDOW_YEARS;
export const FESTIVALS_BROWSE_MAX_YEAR = FESTIVALS_MAX_YEAR + FESTIVALS_COMPUTE_WINDOW_YEARS;

/** Whether `year` is one this service computes (browsable, and not in the table). */
export function isFestivalYearComputable(year: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= FESTIVALS_BROWSE_MIN_YEAR &&
    year <= FESTIVALS_BROWSE_MAX_YEAR &&
    !isFestivalYearInTable(year)
  );
}

/**
 * Where one year stands. `days` is always usable as-is (sorted, table-shaped):
 * the final list when `complete`, the rows computed so far otherwise.
 *
 *  - `idle`      — never requested this session.
 *  - `loading`   — requested; waiting its turn or reading the SQLite row.
 *  - `computing` — the engine is running; `daysDone` / `totalDays` is progress.
 *  - `paused`    — its request was aborted part-way; resumable from `daysDone`.
 *  - `complete`  — done; served from memory from here on.
 *  - `error`     — the engine threw; a new request retries (resuming).
 */
export interface FestivalYearState {
  readonly status: 'idle' | 'loading' | 'computing' | 'paused' | 'complete' | 'error';
  readonly days: readonly FestivalTableDay[];
  readonly daysDone: number;
  readonly totalDays: number;
}

/** How often, at most, a running compute republishes its partial rows. Each
 *  publish re-renders the list, so this is the streaming cadence, not the
 *  yield cadence (which is per slice, much finer). */
const PROGRESS_PUBLISH_MS = 250;

const TABLE = 'festival_year_cache';

function computeParams(): FestivalYearComputeParams {
  const build = getFestivalsTableBuild();
  return {
    latitude: build.latitude,
    longitude: build.longitude,
    timezoneOffsetMinutes: build.timezoneOffsetMinutes,
    ayanamsa: build.ayanamsa,
    masaSystem: build.masaSystem,
    region: build.region,
  };
}

/** Everything but `year` in the row key — constant for a JS session, since the
 *  parameters come from the bundled table. Built on first use, not at import,
 *  so importing this module never loads the table (see `@/data/festivals`). */
function rowKey() {
  const build = getFestivalsTableBuild();
  return {
    region: build.region,
    ayanamsa: build.ayanamsa,
    masaSystem: build.masaSystem,
    engineVersion: build.panchangTsVersion,
    refKey: `${build.latitude},${build.longitude},${build.timezoneOffsetMinutes}`,
  };
}

const IDLE: FestivalYearState = Object.freeze({ status: 'idle', days: [], daysDone: 0, totalDays: 0 });

// ─── External store ──────────────────────────────────────────────────────────
// Read with `useSyncExternalStore(subscribeFestivalYears, () =>
// getFestivalYearState(year))`. Each state object is replaced, never mutated,
// so the snapshot for a year is referentially stable between publishes — which
// is what that hook requires, and what lets React skip re-rendering a screen
// whose year did not change when some other year publishes.

const states = new Map<number, FestivalYearState>();
/** Resume points for aborted runs, ahead of (or instead of) the SQLite row. */
const partials = new Map<number, FestivalYearPartial>();
const listeners = new Set<() => void>();

function publish(year: number, next: FestivalYearState): void {
  states.set(year, next);
  for (const listener of listeners) listener();
}

export function subscribeFestivalYears(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current state of `year`; a shared frozen `idle` object for a year never
 *  requested. For a year IN the table this is always `idle` — read the table. */
export function getFestivalYearState(year: number): FestivalYearState {
  return states.get(year) ?? IDLE;
}

// ─── SQLite row ──────────────────────────────────────────────────────────────

interface StoredYear {
  daysDone: number;
  days: FestivalTableDay[];
}

function parseDays(json: string): FestivalTableDay[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    for (const d of parsed) {
      if (!d || typeof d.date !== 'string' || !Array.isArray(d.festivals)) return null;
    }
    return parsed as FestivalTableDay[];
  } catch {
    return null;
  }
}

async function readRow(db: SQLiteDatabase, year: number): Promise<StoredYear | null> {
  const key = rowKey();
  const row = await db.getFirstAsync<{ days_json: string; days_done: number }>(
    `SELECT days_json, days_done FROM ${TABLE}
      WHERE year = ? AND region = ? AND ayanamsa = ? AND masa_system = ?
        AND engine_version = ? AND ref_key = ?
      LIMIT 1`,
    [year, key.region, key.ayanamsa, key.masaSystem, key.engineVersion, key.refKey],
  );
  if (!row) return null;
  const days = parseDays(row.days_json);
  // A row that does not parse is treated as absent and recomputed; the write
  // at the end replaces it.
  if (!days || !Number.isInteger(row.days_done) || row.days_done < 0) return null;
  return { daysDone: row.days_done, days };
}

/** Guards the dead-row sweep to one pass per app launch. */
let prunedThisSession = false;

async function writeRow(db: SQLiteDatabase, year: number, stored: StoredYear): Promise<void> {
  const key = rowKey();
  const json = JSON.stringify(stored.days);
  await db.runAsync(
    `INSERT OR REPLACE INTO ${TABLE}
       (year, region, ayanamsa, masa_system, engine_version, ref_key, days_json, days_done, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      year,
      key.region,
      key.ayanamsa,
      key.masaSystem,
      key.engineVersion,
      key.refKey,
      json,
      stored.daysDone,
      Date.now(),
    ],
  );
  // Rows computed under any other key are unreachable from this build, and
  // rows for years the table now carries (a regenerate widened it) or the
  // window no longer reaches are never read again. One sweep per session,
  // after this row is safely written; a failed sweep must not read as a failed
  // write.
  if (!prunedThisSession) {
    prunedThisSession = true;
    await db
      .runAsync(
        `DELETE FROM ${TABLE}
          WHERE region != ? OR ayanamsa != ? OR masa_system != ?
             OR engine_version != ? OR ref_key != ?
             OR (year BETWEEN ? AND ?)
             OR year < ? OR year > ?`,
        [
          key.region,
          key.ayanamsa,
          key.masaSystem,
          key.engineVersion,
          key.refKey,
          FESTIVALS_MIN_YEAR,
          FESTIVALS_MAX_YEAR,
          FESTIVALS_BROWSE_MIN_YEAR,
          FESTIVALS_BROWSE_MAX_YEAR,
        ],
      )
      .catch(() => {});
  }
}

// ─── The serialized loader ───────────────────────────────────────────────────

/** Tail of the one-at-a-time chain. Never rejects (each link is caught). */
let queueTail: Promise<void> = Promise.resolve();

function pausedOrIdle(year: number, partial: FestivalYearPartial | null): FestivalYearState {
  if (!partial || partial.daysDone === 0) return IDLE;
  return {
    status: 'paused',
    days: partial.days,
    daysDone: partial.daysDone,
    totalDays: festivalYearTotalDays(year),
  };
}

async function runYear(db: SQLiteDatabase, year: number, signal: AbortSignal): Promise<void> {
  if (states.get(year)?.status === 'complete') return;
  const totalDays = festivalYearTotalDays(year);
  let resume: FestivalYearPartial | null = partials.get(year) ?? null;

  // Aborted while waiting its turn: do nothing, and leave the year showing
  // whatever it had rather than a `loading` that nothing will ever finish.
  if (signal.aborted) {
    publish(year, pausedOrIdle(year, resume));
    return;
  }

  let stored: StoredYear | null = null;
  try {
    stored = await readRow(db, year);
  } catch {
    // Unreadable cache (table missing, connection closing): compute anyway,
    // the result is still served from memory for the session.
  }
  if (stored && stored.daysDone >= totalDays) {
    partials.delete(year);
    publish(year, { status: 'complete', days: stored.days, daysDone: totalDays, totalDays });
    return;
  }
  if (stored && stored.daysDone > (resume?.daysDone ?? 0)) resume = stored;
  if (signal.aborted) {
    publish(year, pausedOrIdle(year, resume));
    return;
  }

  publish(year, {
    status: 'computing',
    days: resume?.days ?? [],
    daysDone: resume?.daysDone ?? 0,
    totalDays,
  });

  let lastPublish = Date.now();
  try {
    const result = await computeFestivalYear(year, computeParams(), {
      signal,
      resume,
      onChunk: partial => {
        partials.set(year, partial);
        const now = Date.now();
        if (now - lastPublish < PROGRESS_PUBLISH_MS) return;
        lastPublish = now;
        publish(year, { status: 'computing', days: partial.days, daysDone: partial.daysDone, totalDays });
      },
    });
    if (result.complete) {
      partials.delete(year);
      publish(year, { status: 'complete', days: result.days, daysDone: totalDays, totalDays });
      await writeRow(db, year, result).catch(() => {});
      return;
    }
    partials.set(year, result);
    publish(year, pausedOrIdle(year, result));
    // Persist the progress so a later session resumes too — only when it is
    // actually further along than what the row already holds.
    if (result.daysDone > (stored?.daysDone ?? 0)) {
      await writeRow(db, year, result).catch(() => {});
    }
  } catch (e) {
    const partial = partials.get(year) ?? resume;
    publish(year, {
      status: 'error',
      days: partial?.days ?? [],
      daysDone: partial?.daysDone ?? 0,
      totalDays,
    });
    if (__DEV__) console.warn(`[festivalYearCache] computing ${year} failed`, e);
  }
}

/**
 * Make `year` available: from memory, else the SQLite row, else by computing it
 * (resuming any partial run). Progress and the result arrive through
 * {@link getFestivalYearState}; the returned promise only says the request has
 * settled, and never rejects.
 *
 * Serialized: at most one year computes at a time, in request order. Abort
 * `signal` to withdraw the request — before its turn it does no work, during
 * its turn the engine stops at the end of its current day and keeps what it has.
 *
 * A year in the table, or outside the browse window, is refused (no-op): the
 * table answers the first synchronously via `@/data/festivals`, and the second
 * is exactly the unbounded compute this window exists to prevent.
 */
export function requestFestivalYear(
  db: SQLiteDatabase,
  year: number,
  signal: AbortSignal,
): Promise<void> {
  if (!isFestivalYearComputable(year)) return Promise.resolve();
  const current = states.get(year);
  if (current?.status === 'complete') return Promise.resolve();

  const partial = partials.get(year);
  publish(year, {
    status: 'loading',
    days: partial?.days ?? current?.days ?? [],
    daysDone: partial?.daysDone ?? current?.daysDone ?? 0,
    totalDays: festivalYearTotalDays(year),
  });

  const run = queueTail.then(() => runYear(db, year, signal));
  queueTail = run.catch(() => {});
  return run.catch(() => {});
}
