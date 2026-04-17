import { type SQLiteDatabase } from 'expo-sqlite';

import type { IRashifal } from '@/types';

// Bump this whenever seed data changes to trigger a re-seed on existing installs.
const SEED_VERSION = 8;

async function seedRashifal(db: SQLiteDatabase): Promise<void> {
  const rashifalSeedData = (await import('@/data/static/rashifal.json')).default;
  const entries = rashifalSeedData as IRashifal[];
  for (const r of entries) {
    db.runSync(
      'INSERT OR REPLACE INTO rashifal (date, sign, language, body) VALUES (?, ?, ?, ?)',
      [r.date, r.sign, r.language, r.body]
    );
  }
}

// Called via SQLiteProvider's onInit — receives the same connection
// that will be provided to all children, so no second connection is opened.
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // Aartis/chalisas/kathas were previously seeded into SQLite; they now come
  // from the `hindu-devotional-texts` package at runtime. Kathas are removed
  // from the app entirely. Drop the orphaned tables on existing installs.
  db.execSync('DROP TABLE IF EXISTS aartis');
  db.execSync('DROP TABLE IF EXISTS chalisas');
  db.execSync('DROP TABLE IF EXISTS kathas');

  // Rashifal table — daily horoscope per (date, sign, language)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS rashifal (
      date TEXT NOT NULL,
      sign TEXT NOT NULL,
      language TEXT NOT NULL,
      body TEXT NOT NULL,
      PRIMARY KEY (date, sign, language)
    );
  `);

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

  // Meta table for tracking seed version
  db.execSync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Check current seed version
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['seedVersion']);
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  if (currentVersion < SEED_VERSION) {
    await seedRashifal(db);
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['seedVersion', String(SEED_VERSION)]);
  }
}
