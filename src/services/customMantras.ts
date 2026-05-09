import { type SQLiteDatabase } from 'expo-sqlite';

export interface CustomMantra {
  id: number;
  text: string;
  createdAt: number;
  lastUsedAt: number;
}

interface CustomMantraRow {
  id: number;
  text: string;
  created_at: number;
  last_used_at: number;
}

function rowToMantra(row: CustomMantraRow): CustomMantra {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

/** Insert a typed mantra, or — if its text already exists — bump
 *  `last_used_at` so it floats to the top of the recents list. Returns the
 *  row id, or -1 if the input was empty. */
export function saveCustomMantra(db: SQLiteDatabase, text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return -1;
  const now = Date.now();
  const existing = db.getFirstSync<{ id: number }>(
    'SELECT id FROM custom_mantras WHERE text = ?',
    [trimmed],
  );
  if (existing) {
    db.runSync('UPDATE custom_mantras SET last_used_at = ? WHERE id = ?', [now, existing.id]);
    return existing.id;
  }
  const result = db.runSync(
    'INSERT INTO custom_mantras (text, created_at, last_used_at) VALUES (?, ?, ?)',
    [trimmed, now, now],
  );
  return result.lastInsertRowId;
}

export function listCustomMantras(db: SQLiteDatabase, limit = 20): CustomMantra[] {
  const rows = db.getAllSync<CustomMantraRow>(
    `SELECT id, text, created_at, last_used_at
       FROM custom_mantras
      ORDER BY last_used_at DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map(rowToMantra);
}

export function deleteCustomMantra(db: SQLiteDatabase, id: number): void {
  db.runSync('DELETE FROM custom_mantras WHERE id = ?', [id]);
}
