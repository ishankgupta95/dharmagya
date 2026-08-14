import { type SQLiteDatabase } from 'expo-sqlite';

/** A completed jaap (mantra repetition) session. Sessions are sealed when the
 *  user leaves the counter — partial sessions don't persist (running state
 *  lives only in component state). `mantraSlug` is either a slug from
 *  hindu-devotional-texts or the literal string `"custom"` for free-form
 *  mantras the user typed; `mantraLabel` snapshots the title at write time
 *  so the history list renders without re-resolving the package. */
export interface JaapSession {
  id: number;
  startedAt: number; // epoch ms
  endedAt: number;   // epoch ms
  mantraSlug: string;
  mantraLabel: string;
  malaSize: number;
  malaCount: number;
  totalCount: number;
}

/** Sentinel slug for user-typed mantras that aren't in the package. */
export const CUSTOM_MANTRA_SLUG = 'custom';

interface JaapSessionInsert {
  startedAt: number;
  endedAt: number;
  mantraSlug: string;
  mantraLabel: string;
  malaSize: number;
  malaCount: number;
  totalCount: number;
}

export function insertJaapSession(db: SQLiteDatabase, session: JaapSessionInsert): number {
  const result = db.runSync(
    `INSERT INTO jaap_sessions
       (started_at, ended_at, mantra_slug, mantra_label, mala_size, mala_count, total_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.startedAt,
      session.endedAt,
      session.mantraSlug,
      session.mantraLabel,
      session.malaSize,
      session.malaCount,
      session.totalCount,
    ],
  );
  return result.lastInsertRowId;
}

interface JaapSessionRow {
  id: number;
  started_at: number;
  ended_at: number;
  mantra_slug: string;
  mantra_label: string;
  mala_size: number;
  mala_count: number;
  total_count: number;
}

function rowToSession(row: JaapSessionRow): JaapSession {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    mantraSlug: row.mantra_slug,
    mantraLabel: row.mantra_label,
    malaSize: row.mala_size,
    malaCount: row.mala_count,
    totalCount: row.total_count,
  };
}

/** History query — most recent first. The plan caps the surfaced list at 30. */
export function listJaapSessions(db: SQLiteDatabase, limit = 30): JaapSession[] {
  const rows = db.getAllSync<JaapSessionRow>(
    `SELECT id, started_at, ended_at, mantra_slug, mantra_label,
            mala_size, mala_count, total_count
       FROM jaap_sessions
      ORDER BY started_at DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map(rowToSession);
}

/** Aggregate stats — used for the history hero + a discover-section "your
 *  total". Reads in one query so lists with hundreds of sessions stay snappy. */
export interface JaapStats {
  sessionCount: number;
  totalCount: number;
  totalMalas: number;
  /** Total time in sessions, ms. */
  totalDurationMs: number;
}

export function getJaapStats(db: SQLiteDatabase): JaapStats {
  const row = db.getFirstSync<{
    session_count: number;
    total_count: number | null;
    total_malas: number | null;
    total_duration: number | null;
  }>(
    `SELECT COUNT(*) AS session_count,
            SUM(total_count) AS total_count,
            SUM(mala_count) AS total_malas,
            SUM(MAX(ended_at - started_at, 0)) AS total_duration
       FROM jaap_sessions`,
  );
  return {
    sessionCount: row?.session_count ?? 0,
    totalCount: row?.total_count ?? 0,
    totalMalas: row?.total_malas ?? 0,
    totalDurationMs: row?.total_duration ?? 0,
  };
}

/** Per-day mala totals for the history density grid (frame 25). Keys are
 *  local-time "YYYY-MM-DD" strings; days without practice are absent. */
export function getJaapDailyMalas(db: SQLiteDatabase, sinceMs: number): Map<string, number> {
  const rows = db.getAllSync<{ day: string; malas: number | null }>(
    `SELECT date(started_at / 1000, 'unixepoch', 'localtime') AS day,
            SUM(mala_count) AS malas
       FROM jaap_sessions
      WHERE started_at >= ?
      GROUP BY day`,
    [sinceMs],
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, r.malas ?? 0);
  return map;
}

export function deleteJaapSession(db: SQLiteDatabase, id: number): void {
  db.runSync('DELETE FROM jaap_sessions WHERE id = ?', [id]);
}
