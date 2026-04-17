import type { VratType } from '@/types';
import festivalsData from '@/data/static/festivals.json';

// ─── Festival → VratType mapping ────────────────────────────────────────────
// Maps festival names from festivals.json to a VratType. Currently used by the
// notification scheduler to label vrat-day reminders with the matching tithi
// observance (e.g. "Ekadashi" instead of just the festival name).
const FESTIVAL_NAME_TO_VRAT: Record<string, VratType> = {
  Ekadashi: 'ekadashi',
  'Pradosha Vrata': 'pradosha',
  'Sharad Purnima': 'purnima',
  'Guru Purnima': 'purnima',
  'Kartika Purnima': 'purnima',
  'Mahalaya Amavasya': 'amavasya',
  'Maha Shivaratri': 'shivaratri',
  'Karva Chauth': 'karwa_chauth',
  'Krishna Janmashtami': 'janmashtami',
  'Sharad Navaratri': 'navratri',
  'Durga Ashtami': 'navratri',
  'Maha Navami': 'navratri',
};

// Map festival TYPE (broader) as a fallback when name lookup fails.
const FESTIVAL_TYPE_TO_VRAT: Record<string, VratType> = {
  ekadashi: 'ekadashi',
  pradosha: 'pradosha',
};

/** Returns the VratType for a single festival entry, or null. */
export function vratTypeForFestival(festival: { name: string; type: string }): VratType | null {
  return (
    FESTIVAL_NAME_TO_VRAT[festival.name] ??
    FESTIVAL_TYPE_TO_VRAT[festival.type] ??
    null
  );
}

/** Returns the first VratType matching any festival on the given date, or null. */
export function vratTypeForDate(date: Date): VratType | null {
  const yearKey = String(date.getFullYear());
  const ymd = toYmd(date);
  const yearData = (festivalsData as Record<string, { date: string; festivals: { name: string; type: string }[] }[]>)[yearKey];
  if (!yearData) return null;
  const day = yearData.find(d => d.date === ymd);
  if (!day) return null;
  for (const f of day.festivals) {
    const vt = vratTypeForFestival(f);
    if (vt) return vt;
  }
  return null;
}

/** Returns the festival name for a vrat on the given date, or null. Used for notification bodies. */
export function vratFestivalNameForDate(date: Date): { name: string; vratType: VratType } | null {
  const yearKey = String(date.getFullYear());
  const ymd = toYmd(date);
  const yearData = (festivalsData as Record<string, { date: string; festivals: { name: string; type: string }[] }[]>)[yearKey];
  if (!yearData) return null;
  const day = yearData.find(d => d.date === ymd);
  if (!day) return null;
  for (const f of day.festivals) {
    const vt = vratTypeForFestival(f);
    if (vt) return { name: f.name, vratType: vt };
  }
  return null;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
