import { type SQLiteDatabase } from 'expo-sqlite';

// Called via SQLiteProvider's onInit — receives the same connection
// that will be provided to all children, so no second connection is opened.
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // Aartis/chalisas/kathas were previously seeded into SQLite; they now come
  // from the `hindu-devotional-texts` package at runtime. Kathas are removed
  // from the app entirely. Rashifal was a 30-day pilot that has been removed.
  // Drop all orphaned tables on existing installs.
  db.execSync('DROP TABLE IF EXISTS aartis');
  db.execSync('DROP TABLE IF EXISTS chalisas');
  db.execSync('DROP TABLE IF EXISTS kathas');
  db.execSync('DROP TABLE IF EXISTS rashifal');
  db.execSync('DROP TABLE IF EXISTS meta');

  // Muhurat cache — persists a rolling 365-day scan per (occasion, location).
  // lat_key/lon_key are coordinates rounded to 1 decimal (~11km) so nearby
  // users share cache. matches_json holds the full MuhuratMatch[] (incl. each
  // day's panchang) so the UI renders expanded slots without refetching.
  // scanned_through is the last YYYY-MM-DD successfully evaluated; a partial
  // scan can resume from there. Past matches (date < today) are pruned on write.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS muhurat_cache (
      occasion TEXT NOT NULL,
      lat_key TEXT NOT NULL,
      lon_key TEXT NOT NULL,
      matches_json TEXT NOT NULL DEFAULT '[]',
      scanned_through TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (occasion, lat_key, lon_key)
    );
  `);

  // 1: 1.5.0 — excludedVaras rule was a no-op before (English weekday vs.
  // panchang-ts Sanskrit name), so cached scans may include forbidden
  // weekdays. Drop them once so the next open recomputes correctly.
  // 2: panchang-ts 3.1.0 — runtime now validates muhurats with the library's
  // stock rules + scoreMuhurta (Bhadra / Panchaka / Adhika Maasa / eclipse /
  // Ganda Mula exclusions added vs. the prior local rules). Old caches will
  // contain days the new rules now reject, so wipe once on upgrade.
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 2) {
    db.execSync('DELETE FROM muhurat_cache');
    db.execSync('PRAGMA user_version = 2');
  }
}
