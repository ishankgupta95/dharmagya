import { type SQLiteDatabase } from 'expo-sqlite';

/** Sadhana milestone kinds (P14.4). All three are private to the user — no
 *  leaderboards, no comparison. The celebration overlay reads `kind` to pick
 *  the headline phrasing ("repetitions" vs. "day sadhana" vs. "sessions"). */
export type MilestoneKind = 'sessions' | 'repetitions' | 'streak';

export interface MilestoneEntry {
  id: number;
  kind: MilestoneKind;
  threshold: number;
  achievedAt: number;
}

/** Sacred-number thresholds, ascending. Crossing one inserts a row + opens
 *  the celebration overlay. The same threshold for the same kind only counts
 *  once ever — re-crossing (e.g. after a streak reset + climb-back) is a
 *  no-op, by design: a "first 108 days" plaque shouldn't be earned twice. */
export const SESSION_THRESHOLDS: readonly number[] = [7, 21, 30, 108, 365] as const;
export const REPETITION_THRESHOLDS: readonly number[] = [108, 1_008, 10_800, 108_000] as const;
export const STREAK_THRESHOLDS: readonly number[] = [7, 21, 30, 108, 365] as const;

const THRESHOLDS: Record<MilestoneKind, readonly number[]> = {
  sessions: SESSION_THRESHOLDS,
  repetitions: REPETITION_THRESHOLDS,
  streak: STREAK_THRESHOLDS,
};

interface MilestoneRow {
  id: number;
  kind: string;
  threshold: number;
  achieved_at: number;
}

function rowToEntry(row: MilestoneRow): MilestoneEntry {
  return {
    id: row.id,
    kind: row.kind as MilestoneKind,
    threshold: row.threshold,
    achievedAt: row.achieved_at,
  };
}

/** Returns every threshold the user has already crossed for `kind`. */
export function listAchievedThresholds(db: SQLiteDatabase, kind: MilestoneKind): Set<number> {
  const rows = db.getAllSync<MilestoneRow>(
    `SELECT id, kind, threshold, achieved_at
       FROM milestones_achieved
      WHERE kind = ?`,
    [kind],
  );
  return new Set(rows.map((r) => r.threshold));
}

/** Records a milestone if not already present. Returns true if the insert
 *  happened (caller should fire the celebration), false if it was a duplicate. */
export function recordMilestone(
  db: SQLiteDatabase,
  kind: MilestoneKind,
  threshold: number,
  achievedAt: number,
): boolean {
  const result = db.runSync(
    `INSERT OR IGNORE INTO milestones_achieved (kind, threshold, achieved_at)
     VALUES (?, ?, ?)`,
    [kind, threshold, achievedAt],
  );
  return result.changes > 0;
}

/** Given a kind, the *new* total (sessions count / cumulative reps / streak
 *  days), and the set of already-achieved thresholds, returns every threshold
 *  the new total has crossed but hasn't been recorded yet. Ascending. */
export function findNewlyCrossed(
  kind: MilestoneKind,
  newTotal: number,
  alreadyAchieved: Set<number>,
): number[] {
  const out: number[] = [];
  for (const threshold of THRESHOLDS[kind]) {
    if (newTotal >= threshold && !alreadyAchieved.has(threshold)) {
      out.push(threshold);
    }
  }
  return out;
}

/** History query used by the picker stats row to surface "you've earned N
 *  milestones." Caps at the latest 30 for the same reason as the session list. */
export function listMilestones(db: SQLiteDatabase, limit = 30): MilestoneEntry[] {
  const rows = db.getAllSync<MilestoneRow>(
    `SELECT id, kind, threshold, achieved_at
       FROM milestones_achieved
      ORDER BY achieved_at DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map(rowToEntry);
}

export function countMilestones(db: SQLiteDatabase): number {
  const row = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM milestones_achieved',
  );
  return row?.n ?? 0;
}
