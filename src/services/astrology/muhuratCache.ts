import { type SQLiteDatabase } from 'expo-sqlite';

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

interface SerializedMatch extends Omit<MuhuratMatch, 'date'> {
  date: string; // ISO
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
    return raw.map(r => ({ ...r, date: new Date(r.date) }));
  } catch {
    return [];
  }
}

// ─── Cache row ────────────────────────────────────────────────────────────────

export interface CachedScan {
  matches: MuhuratMatch[];
  /** YYYY-MM-DD of the last day evaluated, or null if nothing scanned. */
  scannedThrough: string | null;
  updatedAt: number;
}

export function readMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
): CachedScan | null {
  const { latKey, lonKey } = roundCoordsKey(coords);
  const row = db.getFirstSync<{
    matches_json: string;
    scanned_through: string | null;
    updated_at: number;
  }>(
    'SELECT matches_json, scanned_through, updated_at FROM muhurat_cache WHERE occasion = ? AND lat_key = ? AND lon_key = ? LIMIT 1',
    [occasion, latKey, lonKey],
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
export function writeMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
  matches: MuhuratMatch[],
  scannedThrough: string | null,
): void {
  const { latKey, lonKey } = roundCoordsKey(coords);
  const today = startOfToday();
  const pruned = matches.filter(m => m.date.getTime() >= today.getTime());
  db.runSync(
    `INSERT OR REPLACE INTO muhurat_cache
       (occasion, lat_key, lon_key, matches_json, scanned_through, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [occasion, latKey, lonKey, serialize(pruned), scannedThrough, Date.now()],
  );
}

export function clearMuhuratCache(
  db: SQLiteDatabase,
  occasion: Occasion,
  coords: { lat: number; lon: number } | null | undefined,
): void {
  const { latKey, lonKey } = roundCoordsKey(coords);
  db.runSync(
    'DELETE FROM muhurat_cache WHERE occasion = ? AND lat_key = ? AND lon_key = ?',
    [occasion, latKey, lonKey],
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
