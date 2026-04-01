import { type SQLiteDatabase } from 'expo-sqlite';

import type { IAarti, IChalisa } from '@/types';
import aartiSeedData from '@/data/static/aartis.json';
import chalisaSeedData from '@/data/static/chalisas.json';

// Bump this whenever seed data changes to trigger a re-seed on existing installs.
const SEED_VERSION = 3;

function seedAartis(db: SQLiteDatabase): void {
  const aartis = aartiSeedData as IAarti[];
  for (const aarti of aartis) {
    db.runSync(
      'INSERT OR REPLACE INTO aartis (id, titleEnglish, titleNative, content, deity) VALUES (?, ?, ?, ?, ?)',
      [aarti.id, aarti.titleEnglish, aarti.titleNative, JSON.stringify(aarti.content), aarti.deity]
    );
  }
}

function seedChalisas(db: SQLiteDatabase): void {
  const chalisas = chalisaSeedData as IChalisa[];
  for (const chalisa of chalisas) {
    db.runSync(
      'INSERT OR REPLACE INTO chalisas (id, titleEnglish, titleNative, deity, sections) VALUES (?, ?, ?, ?, ?)',
      [chalisa.id, chalisa.titleEnglish, chalisa.titleNative, chalisa.deity, JSON.stringify(chalisa.sections)]
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
    seedAartis(db);
    seedChalisas(db);
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['seedVersion', String(SEED_VERSION)]);
  }
}
