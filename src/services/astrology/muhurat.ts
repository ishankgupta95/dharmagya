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

export interface ScanProgress {
  /** YYYY-MM-DD of the day that was just evaluated. */
  day: string;
  /** 1-based index of the day within the scan window. */
  scannedCount: number;
  /** Total days in the scan window (end - start + 1). */
  totalDays: number;
}

export interface ScanOptions {
  occasion: Occasion;
  /** Inclusive start. */
  startDate: Date;
  /** Inclusive end. */
  endDate: Date;
  coords?: { lat: number; lon: number } | null;
  /** Abort to stop the scan early. Resolves with matches collected so far. */
  signal?: AbortSignal;
  /** Called synchronously after each match is found. */
  onMatch?: (match: MuhuratMatch) => void;
  /** Called after each day is evaluated (matched or not). */
  onProgress?: (p: ScanProgress) => void;
  /**
   * Every this many days the scan yields to the event loop so the UI stays
   * responsive on mid-tier Androids. Defaults to 5.
   */
  yieldEvery?: number;
}

/**
 * Streaming, cancellable scan for auspicious days. Walks the date range one
 * day at a time, computing the panchang and evaluating the occasion's rule.
 * Yields to the event loop periodically so touches / taps aren't blocked,
 * and honors `signal.aborted` between days so the caller can cancel.
 *
 * Best-effort classical rule evaluator — users should consult a pandit for
 * high-stakes events.
 */
export async function scanAuspiciousDays(opts: ScanOptions): Promise<MuhuratMatch[]> {
  const rule = RULES[opts.occasion];
  const yieldEvery = opts.yieldEvery ?? 5;
  const out: MuhuratMatch[] = [];

  const cursor = new Date(opts.startDate);
  cursor.setHours(12, 0, 0, 0); // noon to avoid DST-boundary drift
  const end = new Date(opts.endDate);
  end.setHours(12, 0, 0, 0);

  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - cursor.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  let scannedCount = 0;

  while (cursor.getTime() <= end.getTime()) {
    if (opts.signal?.aborted) return out;

    const panchang = await fetchPanchang(new Date(cursor), opts.coords ?? null, false, 'en');
    if (panchang) {
      const match = evaluateDay(panchang, rule);
      if (match) {
        const entry: MuhuratMatch = {
          date: new Date(cursor),
          tithi: match.tithi,
          nakshatra: match.nakshatra,
          yoga: match.yoga,
          vara: match.vara,
          panchang,
        };
        out.push(entry);
        opts.onMatch?.(entry);
      }
    }

    scannedCount += 1;
    opts.onProgress?.({
      day: ymdLocal(cursor),
      scannedCount,
      totalDays,
    });

    cursor.setDate(cursor.getDate() + 1);

    // Yield to the event loop so touches / re-renders can happen between
    // expensive panchang computations.
    if (scannedCount % yieldEvery === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  return out;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
