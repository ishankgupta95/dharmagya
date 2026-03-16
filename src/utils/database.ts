import { type SQLiteDatabase } from 'expo-sqlite';

import type { IAarti, IChalisa } from '@/types';
import aartiSeedData from '@/data/static/aartis.json';
import chalisaSeedData from '@/data/static/chalisas.json';

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

  // Seed if empty
  const aartiCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM aartis');
  if (aartiCount && aartiCount.count === 0) {
    seedAartis(db);
  }

  const chalisaCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM chalisas');
  if (chalisaCount && chalisaCount.count === 0) {
    seedChalisas(db);
  }
}
