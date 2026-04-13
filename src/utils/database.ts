import { type SQLiteDatabase } from 'expo-sqlite';

import type { IAarti, IChalisa, IKatha, IRashifal } from '@/types';

// Bump this whenever seed data changes to trigger a re-seed on existing installs.
const SEED_VERSION = 7;

async function seedAartis(db: SQLiteDatabase): Promise<void> {
  const aartiSeedData = (await import('@/data/static/aartis.json')).default;
  const aartis = aartiSeedData as IAarti[];
  for (const aarti of aartis) {
    db.runSync(
      'INSERT OR REPLACE INTO aartis (id, titleEnglish, titleNative, content, deity) VALUES (?, ?, ?, ?, ?)',
      [aarti.id, aarti.titleEnglish, aarti.titleNative, JSON.stringify(aarti.content), aarti.deity]
    );
  }
}

async function seedChalisas(db: SQLiteDatabase): Promise<void> {
  const chalisaSeedData = (await import('@/data/static/chalisas.json')).default;
  const chalisas = chalisaSeedData as IChalisa[];
  for (const chalisa of chalisas) {
    db.runSync(
      'INSERT OR REPLACE INTO chalisas (id, titleEnglish, titleNative, deity, sections) VALUES (?, ?, ?, ?, ?)',
      [chalisa.id, chalisa.titleEnglish, chalisa.titleNative, chalisa.deity, JSON.stringify(chalisa.sections)]
    );
  }
}

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

async function seedKathas(db: SQLiteDatabase): Promise<void> {
  const kathaSeedData = (await import('@/data/static/kathas.json')).default;
  const kathas = kathaSeedData as IKatha[];
  for (const katha of kathas) {
    db.runSync(
      'INSERT OR REPLACE INTO kathas (id, titleEnglish, titleNative, deity, summary, content, vrat_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        katha.id,
        katha.titleEnglish,
        katha.titleNative,
        katha.deity,
        katha.summary,
        JSON.stringify(katha.paragraphs),
        katha.vratType ?? null,
      ]
    );
  }
}

// Called via SQLiteProvider's onInit — receives the same connection
// that will be provided to all children, so no second connection is opened.
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // Aartis table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS aartis (
      id TEXT PRIMARY KEY NOT NULL,
      titleEnglish TEXT NOT NULL,
      titleNative TEXT NOT NULL,
      content TEXT NOT NULL,
      deity TEXT NOT NULL
    );
  `);

  // Chalisas table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS chalisas (
      id TEXT PRIMARY KEY NOT NULL,
      titleEnglish TEXT NOT NULL,
      titleNative TEXT NOT NULL,
      deity TEXT NOT NULL,
      sections TEXT NOT NULL
    );
  `);

  // Kathas table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS kathas (
      id TEXT PRIMARY KEY NOT NULL,
      titleEnglish TEXT NOT NULL,
      titleNative TEXT NOT NULL,
      deity TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      vrat_type TEXT
    );
  `);

  // Migration: add vrat_type column for installs created before seed v6.
  // ALTER TABLE ADD COLUMN is idempotent-unsafe in SQLite (errors if exists),
  // so guard by checking pragma.
  const kathaCols = db.getAllSync<{ name: string }>("PRAGMA table_info(kathas)");
  if (!kathaCols.some(c => c.name === 'vrat_type')) {
    db.execSync('ALTER TABLE kathas ADD COLUMN vrat_type TEXT');
  }

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
    await seedAartis(db);
    await seedChalisas(db);
    await seedKathas(db);
    await seedRashifal(db);
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['seedVersion', String(SEED_VERSION)]);
  }
}
