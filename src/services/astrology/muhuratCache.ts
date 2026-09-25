import { type SQLiteDatabase } from 'expo-sqlite';
import type { AyanamsaType, MuhurtaFactor } from 'panchang-ts';

import type { MuhuratMatch, Occasion } from './muhurat';

// ─── Key rounding ─────────────────────────────────────────────────────────────
// Panchang barely differs within ~11km, so we round lat/lon to 1 decimal place
// to let neighbours share cache. Stored as string so sign/precision round-trip
// exactly through SQLite and PRIMARY KEY matching works.

export function roundCoordsKey(
  coords: { lat: number; lon: number } | null | undefined,
): { latKey: string; lonKey: string } {
  if (!coords) return { latKey: 'none', lonKey: 'none' };
  return { latKey: coords.lat.toFixed(1), lonKey: coords.lon.toFixed(1) };
}

// ─── Serialization ────────────────────────────────────────────────────────────

interface SerializedMatch extends Omit<MuhuratMatch, 'date' | 'factors'> {
  date: string; // ISO
  /** Absent on rows written before schema v8 introduced the field. */
  factors?: MuhurtaFactor[];
}

function serialize(matches: MuhuratMatch[]): string {
  const payload: SerializedMatch[] = matches.map(m => ({
    ...m,
    date: m.date.toISOString(),
  }));
  return JSON.stringify(payload);
}

function deserialize(json: string): MuhuratMatch[] {
  try {
    const raw = JSON.parse(json) as SerializedMatch[];
    // The v9 migration wipes every row written before `factors` existed, so
    // `?? []` should never fire in practice — it stays because a missing
    // field would otherwise throw inside the reason list mid-render, and this
    // whole function is written to degrade rather than crash.
    return raw.map(r => ({ ...r, factors: r.factors ?? [], date: new Date(r.date) }));
  } catch {
    return [];
  }
}

// ─── Cache row ────────────────────────────────────────────────────────────────

/**
 * How long a row survives without being rewritten. A scan covers 365 days from
 * the day it ran, so at 60 days a stale row is still mostly useful if the user
 * comes back to that location — past that it is dead weight for a place they
 * have not opened the finder from in two months.
 */
const STALE_ROW_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/** Guards the stale-row sweep to one pass per app launch (see below). */
let prunedThisSession = false;

export interface CachedScan {
  matches: MuhuratMatch[];
  /** YYYY-MM-DD of the last day evaluated, or null if nothing scanned. */
  scannedThrough: string | null;
  updatedAt: number;
}

// Rows carry 240–345 KB of JSON, so the `*Sync` variants of these statements
// parked the JS thread for the length of the read/write — the write fires from
// the muhurat screen's unmount, i.e. during the back-navigation transition.
// Everything here is async; the callers are already inside effects.
export async function readMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
  ayanamsa: AyanamsaType,
): Promise<CachedScan | null> {
  const { latKey, lonKey } = roundCoordsKey(coords);
  const row = await db.getFirstAsync<{
    matches_json: string;
    scanned_through: string | null;
    updated_at: number;
  }>(
    'SELECT matches_json, scanned_through, updated_at FROM muhurat_cache WHERE occasion = ? AND lat_key = ? AND lon_key = ? AND ayanamsa = ? LIMIT 1',
    [occasion, latKey, lonKey, ayanamsa],
  );
  if (!row) return null;
  return {
    matches: deserialize(row.matches_json),
    scannedThrough: row.scanned_through,
    updatedAt: row.updated_at,
  };
}

/**
 * Write (or update) the cache row for this (occasion, location). Past matches
 * (date < today) are pruned before persisting so the stored JSON doesn't grow
 * unboundedly as days tick forward.
 */
export async function writeMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
  ayanamsa: AyanamsaType,
  matches: MuhuratMatch[],
  scannedThrough: string | null,
): Promise<void> {
  const { latKey, lonKey } = roundCoordsKey(coords);
  const today = startOfToday();
  // Serialisation happens synchronously, before the first await, so callers can
  // hand in the array a scan is still pushing into.
  const pruned = matches.filter(m => m.date.getTime() >= today.getTime());
  const json = serialize(pruned);
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO muhurat_cache
       (occasion, lat_key, lon_key, ayanamsa, matches_json, scanned_through, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [occasion, latKey, lonKey, ayanamsa, json, scannedThrough, now],
  );
  // `updated_at` was written on every save and never read: nothing but the
  // user's own Refresh ever deleted a row, so every (location, ayanamsa) the
  // user has ever scanned kept its ~1.6 MB of rows for good — and auto_vacuum
  // is NONE, so the file never gives the pages back on its own. A scan older
  // than the window it covers is worthless anyway (its dates are in the past),
  // so retire it here rather than growing a separate sweep.
  //
  // Once per session, not per write: `updated_at` sits behind `matches_json` in
  // the record, so the unindexed scan walks each row's overflow pages, and a
  // full scan writes this row every PERSIST_EVERY days. The row is already
  // saved by this point, so a failed prune must not read as a failed write.
  if (!prunedThisSession) {
    prunedThisSession = true;
    await db
      .runAsync('DELETE FROM muhurat_cache WHERE updated_at < ?', [now - STALE_ROW_TTL_MS])
      .catch(() => {});
  }
}

export async function clearMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
  ayanamsa: AyanamsaType,
): Promise<void> {
  const { latKey, lonKey } = roundCoordsKey(coords);
  await db.runAsync(
    'DELETE FROM muhurat_cache WHERE occasion = ? AND lat_key = ? AND lon_key = ? AND ayanamsa = ?',
    [occasion, latKey, lonKey, ayanamsa],
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
