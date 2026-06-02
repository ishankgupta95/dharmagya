/**
 * Festival CONTENT — re-export boundary over `hindu-devotional-texts` (v0.7.0+).
 *
 * The lib ships 63 observance entries (26 Ekādaśīs, 6 tithi-vrats, 31
 * festivals) carrying significance / origin story / scriptural source / roster
 * deity + cross-link slugs — but **no dates**. Dates come from the panchang-ts
 * bundled table (`src/data/festivals.ts`); this layer enriches a dated calendar
 * row by matching its (English) panchang name to a lib `FestivalEntry`.
 *
 * Matching: the panchang-ts table uses plain-ASCII display names ("Rama
 * Navami"), and the lib `id`s are plain-ASCII kebab ("rama-navami"), so a
 * kebab-normalised name matches the id directly for most festivals. The
 * `ALIAS` table covers the genuine divergences (Dussehra→vijayadashami,
 * Sharad Navaratri→navratri, …) and the Ekādaśīs, whose panchang name carries
 * a month/paksha suffix the lib id may not.
 */
import {
  getAllFestivals,
  getEkadashis,
  getFestivalsByCategory,
  getFestivalsForDeity,
  FESTIVAL_SOURCES,
  type FestivalEntry,
  type FestivalCategory,
} from 'hindu-devotional-texts';

import { sanitizeBilingual } from '@/utils/sanitizeContent';

export type { FestivalEntry, FestivalCategory };
export { FESTIVAL_SOURCES, getEkadashis, getFestivalsByCategory, getFestivalsForDeity };

function sanitizeFestival(f: FestivalEntry): FestivalEntry {
  return { ...f, significance: sanitizeBilingual(f.significance) };
}

const ALL: readonly FestivalEntry[] = getAllFestivals().map(sanitizeFestival);
const BY_ID = new Map<string, FestivalEntry>(ALL.map((f) => [f.id, f]));

export function getFestivalContentById(id: string | undefined): FestivalEntry | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

/** lower-case, strip diacritics, collapse to kebab-ascii. */
function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Drop parenthetical qualifiers ("Vat Savitri (Purnima)" → "Vat Savitri"). */
function stripParens(s: string): string {
  return s.replace(/\([^)]*\)/g, ' ').trim();
}

/**
 * panchang-ts name (kebab) → lib festival id, for the cases a direct
 * id-equality match misses. Tuned against `getFestivalsForYear()` output — see
 * the coverage check in the PR notes; unmatched panchang majors fall through to
 * `undefined` (the row just stays un-tappable, no broken link).
 */
const ALIAS: Record<string, string> = {
  // Festivals whose display name diverges from the lib id.
  'dussehra': 'vijayadashami',
  'deepavali': 'diwali',
  'sharad-navaratri': 'navratri',
  'shardiya-navaratri': 'navratri',
  'chaitra-navaratri': 'chaitra-navratri',
  'janmashtami': 'krishna-janmashtami',
  'ugadi': 'gudi-padwa',
  'thiru-onam': 'onam',
  'dev-deepavali': 'kartik-purnima',
  'mesha-sankranti': 'baisakhi',
  'narsimha-jayanti': 'narasimha-jayanti',
  'janaki-navami': 'sita-navami',
  'jagannath-rath-yatra': 'ratha-yatra',
  'rath-yatra': 'ratha-yatra',
  // Chhath is emitted as four daily steps; all point at the one content entry.
  'chhath-nahay-khay': 'chhath-puja',
  'chhath-kharna': 'chhath-puja',
  'chhath-sandhya-arghya': 'chhath-puja',
  'chhath-usha-arghya': 'chhath-puja',
  // Tithi-vrats.
  'pradosha-vrata': 'pradosha-vrat',
  // Ekadashi name/spelling divergences (panchang vs lib id).
  'devshayani-ekadashi': 'devashayani-ekadashi',
  'pausha-putrada-ekadashi': 'putrada-ekadashi-pausha',
  'putrada-pavitra-ekadashi': 'putrada-ekadashi-shravana',
  'putrada-ekadashi': 'putrada-ekadashi-shravana',
  'shravana-putrada-ekadashi': 'putrada-ekadashi-shravana',
  'pashankusha-ekadashi': 'papankusha-ekadashi',
};

/**
 * Resolve the lib festival CONTENT for a panchang-ts festival emission. Tries
 * the ALIAS table, then an id-equality match on the (paren-stripped) kebab
 * name, then the description, then a `startsWith` against the longest matching
 * id (catches month-suffixed Ekādaśī descriptions like "Papamochani Ekadashi"
 * → `papamochani-ekadashi`). Returns `undefined` when nothing matches.
 */
export function getFestivalContentForName(name: string, description?: string): FestivalEntry | undefined {
  const candidates = [name, stripParens(name), description, description ? stripParens(description) : undefined]
    .filter(Boolean)
    .map((s) => kebab(s as string));

  for (const k of candidates) {
    if (ALIAS[k] && BY_ID.has(ALIAS[k])) return BY_ID.get(ALIAS[k]);
    if (BY_ID.has(k)) return BY_ID.get(k);
  }
  // Ekadashi suffix tolerance: "papamochani-ekadashi" id vs a name like
  // "Papamochani Ekadashi" handled above; here catch a name that *contains*
  // the ekadashi stem (e.g. "Smarta Papamochani Ekadashi").
  for (const k of candidates) {
    if (!k.includes('ekadashi')) continue;
    const hit = ALL.find((f) => f.category === 'ekadashi' && (k.includes(f.id) || k.startsWith(f.id.replace(/-ekadashi$/, ''))));
    if (hit) return hit;
  }
  return undefined;
}
