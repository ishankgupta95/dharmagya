import { type SQLiteDatabase } from 'expo-sqlite';
import { pmark, ptime } from '@/utils/perfProfile';

// Called via SQLiteProvider's onInit — receives the same connection
// that will be provided to all children, so no second connection is opened.
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  pmark('db:initDatabase:start');
  const end = ptime('db:initDatabase');
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

  // Jaap (mantra) sessions — written when a user completes a counter session.
  // mantra_slug is either a slug from hindu-devotional-texts or the literal
  // "custom" for free-form mantras. mantra_label snapshots the title at write
  // time so the history list renders without re-resolving the package (and so
  // a custom mantra's typed text persists). mala_size is the bead count the
  // user picked (108 default). total_count = mala_count * mala_size + extras
  // — written once on session end; we deliberately don't store live progress
  // (sessions are sealed, the app is the source of truth for the running count).
  db.execSync(`
    CREATE TABLE IF NOT EXISTS jaap_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      mantra_slug TEXT NOT NULL,
      mantra_label TEXT NOT NULL,
      mala_size INTEGER NOT NULL,
      mala_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL
    );
  `);
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_jaap_sessions_started_at
      ON jaap_sessions(started_at DESC);
  `);

  // Custom mantras the user typed in the jaap picker. We persist them so they
  // don't have to retype — listed by `last_used_at DESC` in the picker.
  // `text` is the natural key (UNIQUE) so retyping the same mantra just bumps
  // recency rather than creating a dupe.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS custom_mantras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    );
  `);
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_custom_mantras_last_used_at
      ON custom_mantras(last_used_at DESC);
  `);

  // Sadhana milestones the user has crossed (P14.4). `kind` is one of
  // 'sessions' | 'repetitions' | 'streak'; `threshold` is the sacred-number
  // boundary just crossed (108, 1008, …). UNIQUE(kind, threshold) makes the
  // insert idempotent — re-crossing the same threshold doesn't double-log
  // and doesn't re-trigger the celebration overlay.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS milestones_achieved (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      achieved_at INTEGER NOT NULL,
      UNIQUE(kind, threshold)
    );
  `);

  // 1: 1.5.0 — excludedVaras rule was a no-op before (English weekday vs.
  // panchang-ts Sanskrit name), so cached scans may include forbidden
  // weekdays. Drop them once so the next open recomputes correctly.
  // 2: panchang-ts 3.1.0 — runtime now validates muhurats with the library's
  // stock rules + scoreMuhurta (Bhadra / Panchaka / Adhika Maasa / eclipse /
  // Ganda Mula exclusions added vs. the prior local rules). Old caches will
  // contain days the new rules now reject, so wipe once on upgrade.
  // 3: 1.6.0 — jaap_sessions table introduced. No old data to migrate; the
  // bump just records that the schema reached version 3.
  // 4: custom_mantras table introduced. No old data to migrate; bump records
  // that the schema reached version 4.
  // 5: MuhuratMatch gained `score` + `reasons` (Phase 13b, 4.1 score surface).
  // Old cache JSON lacks both fields; wipe muhurat_cache once so every row
  // re-fills with the score data the DayRow now renders.
  // 6: milestones_achieved table introduced (P14.4 sadhana milestones). No
  // old data to migrate; the bump just records that the schema reached v6.
  // 7: panchang-ts 5.x. Two independent reasons to wipe muhurat_cache: the
  // embedded `IPanchangDay` gained collection-shaped `varjyam` / `amritKala`
  // (old rows carry the removed `varjyamStart` scalars and would render blank
  // rows), and the stock muhurta rules were themselves rebuilt against
  // DrikPanchang's published calendars — 26 defects across all 13 rules, plus
  // Vara×Tithi yoga scoring and Bhadra demoted from whole-day veto to a
  // penalty — so cached scans list days the new rules reject and omit days
  // they now accept.
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 2) {
    db.execSync('DELETE FROM muhurat_cache');
    db.execSync('PRAGMA user_version = 2');
  }
  if (version < 3) {
    db.execSync('PRAGMA user_version = 3');
  }
  if (version < 4) {
    db.execSync('PRAGMA user_version = 4');
  }
  if (version < 5) {
    db.execSync('DELETE FROM muhurat_cache');
    db.execSync('PRAGMA user_version = 5');
  }
  if (version < 6) {
    db.execSync('PRAGMA user_version = 6');
  }
  if (version < 7) {
    db.execSync('DELETE FROM muhurat_cache');
    db.execSync('PRAGMA user_version = 7');
  }
  end();
}
