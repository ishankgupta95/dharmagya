import { fetchPanchang } from './panchangService';
import type { IPanchangDay } from '@/types';

// ─── Occasions ────────────────────────────────────────────────────────────────

export type Occasion =
  | 'vivah'
  | 'griha-pravesh'
  | 'namkaran'
  | 'vahan'
  | 'mundan'
  | 'annaprashan'
  | 'vidyarambh';

export const ALL_OCCASIONS: Occasion[] = [
  'vivah',
  'griha-pravesh',
  'namkaran',
  'vahan',
  'mundan',
  'annaprashan',
  'vidyarambh',
];

// ─── Rule-base types ──────────────────────────────────────────────────────────

interface OccasionRule {
  /** Allowed tithi names (after stripping paksha prefix). English names. */
  auspiciousTithis: string[];
  /** Nakshatra names (English) considered auspicious for this occasion. */
  auspiciousNakshatras: string[];
  /** Varas (English) that are forbidden. */
  excludedVaras: string[];
  /** Yoga names (English) that are forbidden. */
  excludedYogas: string[];
  /** Whether the rule requires Shukla paksha (waxing moon). */
  requiresShuklaPaksha: boolean;
}

// ─── Canonical tithi / nakshatra names (English) ─────────────────────────────
// These mirror what panchang-ts returns for language='en'. Values listed here
// for maintainability; we match case-insensitively.

const TITHI_COMMON = ['Pratipada', 'Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'];

// ─── Per-occasion classical rules ─────────────────────────────────────────────
// Sources: Brihat Parashara Hora Shastra, Muhurta Chintamani, Drik Panchang
// rule tables. These are approximate — sufficient for MVP surfacing.

const RULES: Record<Occasion, OccasionRule> = {
  vivah: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Magha', 'Uttara Phalguni', 'Hasta', 'Swati',
      'Anuradha', 'Mula', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati',
    ],
    excludedVaras: ['Tuesday'],
    excludedYogas: ['Vishkambha', 'Atiganda', 'Shula', 'Ganda', 'Vyaghata', 'Vajra', 'Vyatipata', 'Parigha', 'Vaidhriti'],
    requiresShuklaPaksha: true,
  },
  'griha-pravesh': {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Anuradha', 'Chitra', 'Uttara Phalguni',
      'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati', 'Dhanishta', 'Shatabhisha',
    ],
    excludedVaras: ['Tuesday', 'Saturday', 'Sunday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Vishkambha', 'Ganda', 'Shula', 'Parigha'],
    requiresShuklaPaksha: true,
  },
  namkaran: {
    auspiciousTithis: ['Pratipada', ...TITHI_COMMON, 'Dwadashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Punarvasu', 'Pushya', 'Hasta',
      'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha', 'Vajra'],
    requiresShuklaPaksha: false,
  },
  vahan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Shashthi', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Pushya', 'Punarvasu', 'Hasta',
      'Chitra', 'Uttara Phalguni', 'Uttara Ashadha', 'Uttara Bhadrapada',
      'Revati', 'Anuradha', 'Shravana', 'Dhanishta',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: true,
  },
  mundan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Mrigashirsha', 'Pushya', 'Hasta', 'Chitra', 'Swati',
      'Jyeshtha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Sunday', 'Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha', 'Vajra', 'Vishkambha'],
    requiresShuklaPaksha: true,
  },
  annaprashan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra',
      'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: false,
  },
  vidyarambh: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Shashthi', 'Dashami', 'Ekadashi', 'Dwadashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Ardra', 'Punarvasu', 'Pushya',
      'Hasta', 'Chitra', 'Swati', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Sunday', 'Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: false,
  },
};

// ─── Rule evaluation ──────────────────────────────────────────────────────────

/** Extract the tithi name without its paksha prefix. "Shukla Panchami" → "Panchami". */
function stripPaksha(tithiName: string): { tithi: string; paksha: 'Shukla' | 'Krishna' | null } {
  const trimmed = tithiName.trim();
  if (trimmed.startsWith('Shukla ')) return { tithi: trimmed.slice(7), paksha: 'Shukla' };
  if (trimmed.startsWith('Krishna ')) return { tithi: trimmed.slice(8), paksha: 'Krishna' };
  // Purnima / Amavasya come through without a paksha prefix in some mappings.
  return { tithi: trimmed, paksha: null };
}

export interface MuhuratMatch {
  /** Date with time zeroed to local midnight. */
  date: Date;
  /** Tithi name as displayed. */
  tithi: string;
  /** Nakshatra name as displayed. */
  nakshatra: string;
  /** Yoga name as displayed. */
  yoga: string;
  /** Vara (day of week) name. */
  vara: string;
  /** Full panchang for this day — kept so the UI doesn't need a second fetch. */
  panchang: IPanchangDay;
}

/**
 * Scan a date range and return all days matching the occasion's muhurat rules.
 * This is a best-effort classical rule evaluator — never the final word; users
 * should consult a pandit for high-stakes events.
 */
export async function findAuspiciousDays(
  occasion: Occasion,
  startDate: Date,
  endDate: Date,
  savedCoords?: { lat: number; lon: number } | null,
): Promise<MuhuratMatch[]> {
  const rule = RULES[occasion];
  const out: MuhuratMatch[] = [];

  const cursor = new Date(startDate);
  cursor.setHours(12, 0, 0, 0); // noon to avoid DST-boundary drift
  const end = new Date(endDate);
  end.setHours(12, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    // Skip endTime computation — rules only need which element is prevailing,
    // and for simplicity we check the FIRST element in each list (sunrise-time).
    const panchang = await fetchPanchang(new Date(cursor), savedCoords, false, 'en');
    if (panchang) {
      const match = evaluateDay(panchang, rule);
      if (match) {
        out.push({
          date: new Date(cursor),
          tithi: match.tithi,
          nakshatra: match.nakshatra,
          yoga: match.yoga,
          vara: match.vara,
          panchang,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

interface EvalMatch {
  tithi: string;
  nakshatra: string;
  yoga: string;
  vara: string;
}

function evaluateDay(p: IPanchangDay, rule: OccasionRule): EvalMatch | null {
  const tithiName = p.tithis[0]?.name ?? '';
  const nakshatraName = p.nakshatras[0]?.name ?? '';
  const yogaName = p.yogas[0]?.name ?? '';
  const varaName = p.vara ?? '';

  const { tithi: tithiStripped, paksha } = stripPaksha(tithiName);

  if (rule.requiresShuklaPaksha && paksha !== 'Shukla') return null;
  if (!rule.auspiciousTithis.some(t => ciEq(t, tithiStripped))) return null;
  if (!rule.auspiciousNakshatras.some(n => ciEq(n, nakshatraName))) return null;
  if (rule.excludedVaras.some(v => ciEq(v, varaName))) return null;
  if (rule.excludedYogas.some(y => ciEq(y, yogaName))) return null;

  return { tithi: tithiName, nakshatra: nakshatraName, yoga: yogaName, vara: varaName };
}

function ciEq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
