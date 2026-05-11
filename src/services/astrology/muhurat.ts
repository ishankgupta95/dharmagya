import {
  scoreMuhurta,
  vivahRule,
  grihaPraveshRule,
  namakaranaRule,
  vahanKharidiRule,
  mundanRule,
  annaprashanRule,
  vidyarambhRule,
  type MuhurtaRule,
} from 'panchang-ts';
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

// ─── Stock-rule mapping (panchang-ts is the source of truth) ──────────────────
// Our occasion ids predate the library's stock rules. The mapping below is the
// only place that translates between the two — drop a line here when the lib
// adds new occasions we want to expose. Sources for the stock rules:
// Muhurta-chintamani, Muhurta-darpana, BPHS Ch. 28, cross-checked against
// drikpanchang (see panchang-ts dist for the per-rule citations).
const OCCASION_TO_RULE: Record<Occasion, MuhurtaRule> = {
  vivah: vivahRule,
  'griha-pravesh': grihaPraveshRule,
  namkaran: namakaranaRule,
  vahan: vahanKharidiRule,
  mundan: mundanRule,
  annaprashan: annaprashanRule,
  vidyarambh: vidyarambhRule,
};

// IST is the canonical Indian timezone the panchang is computed against;
// matches the timezone used by `fetchPanchang` and the candidate generator.
const IST_OFFSET_MIN = 330;

// ─── Rule evaluation ──────────────────────────────────────────────────────────

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
  /** Library's auspiciousness score [0..100] from `scoreMuhurta`. Higher is
   *  more auspicious. Always present for fresh writes; SQLite cache schema
   *  bumped to v5 to ensure no pre-score rows linger. */
  score: number;
  /** Why the score landed where it did — short library-supplied notes on
   *  which factors raised or lowered it (tithi / nakshatra / yoga / vara
   *  matches and exclusions). Rendered as a "Why this day" line in the
   *  expanded day detail. */
  reasons: string[];
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
 * Streaming, cancellable validator for a pre-computed candidate-date list.
 * Used on the first-ever open of an occasion screen, when the SQLite cache is
 * empty: instead of scanning all 365 days at the user's location (~365
 * panchang calls), we only validate the candidate dates produced by
 * scripts/generate-muhurat-candidates.js (~50 calls). Each candidate is a
 * date that satisfied the rule at *some* Indian reference longitude;
 * sunrise drifts ~30–40 minutes east-to-west across India, so a date that's
 * auspicious at one longitude might not be at the user's actual location.
 * The validator re-checks each candidate at user coords and filters.
 *
 * Same surface as `scanAuspiciousDays` so callers can swap implementations
 * without changing UI / progress-streaming code.
 */
export interface ValidateOptions {
  occasion: Occasion;
  /** YYYY-MM-DD strings, sorted ascending — output of generate-muhurat-candidates.js */
  candidates: string[];
  coords?: { lat: number; lon: number } | null;
  signal?: AbortSignal;
  onMatch?: (match: MuhuratMatch) => void;
  onProgress?: (p: ScanProgress) => void;
  /** Yield to the event loop every N candidates. Defaults to 5. */
  yieldEvery?: number;
}

export async function validateCandidates(opts: ValidateOptions): Promise<MuhuratMatch[]> {
  const rule = OCCASION_TO_RULE[opts.occasion];
  const yieldEvery = opts.yieldEvery ?? 5;
  const out: MuhuratMatch[] = [];
  const totalDays = opts.candidates.length;
  let scannedCount = 0;

  for (const ymd of opts.candidates) {
    if (opts.signal?.aborted) return out;
    const date = parseYmdLocal(ymd);
    if (!date) {
      scannedCount += 1;
      continue;
    }
    date.setHours(12, 0, 0, 0); // noon avoids DST-boundary drift, mirrors scanAuspiciousDays

    const match = await evaluateAndDescribe(date, rule, opts.coords ?? null);
    if (match) {
      out.push(match);
      opts.onMatch?.(match);
    }

    scannedCount += 1;
    opts.onProgress?.({ day: ymd, scannedCount, totalDays });

    if (scannedCount % yieldEvery === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  return out;
}

function parseYmdLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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
  const rule = OCCASION_TO_RULE[opts.occasion];
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

    const match = await evaluateAndDescribe(new Date(cursor), rule, opts.coords ?? null);
    if (match) {
      out.push(match);
      opts.onMatch?.(match);
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

/**
 * Validate a single date against a stock rule and, when it passes, fetch the
 * project-side `IPanchangDay` for display. We deliberately let `scoreMuhurta`
 * own the rule logic — it knows about Bhadra / Panchaka / Adhika Maasa /
 * eclipse / Ganda Mula exclusions that the prior local rules didn't cover.
 *
 * On a passing day we still need the project's `IPanchangDay` to render
 * tithi / nakshatra / yoga / vara names through the existing localization
 * pipeline, so we call `fetchPanchang` only after the score check passes —
 * failing days cost one panchang compute (inside `scoreMuhurta`) instead of
 * two.
 */
async function evaluateAndDescribe(
  date: Date,
  rule: MuhurtaRule,
  coords: { lat: number; lon: number } | null,
): Promise<MuhuratMatch | null> {
  // The library normalizes `coords ?? null` to a fallback Indian location
  // internally via `fetchPanchang`, but `scoreMuhurta` requires a real
  // GeoLocation. Use Pune as the default — same fallback `fetchPanchang`
  // applies so the two stay aligned.
  const location = coords
    ? { latitude: coords.lat, longitude: coords.lon }
    : { latitude: 18.6298, longitude: 73.7997 };

  let scored;
  try {
    scored = scoreMuhurta(date, location, rule, { timezone: IST_OFFSET_MIN });
  } catch {
    return null;
  }
  if (!scored.passes) return null;

  const panchang = await fetchPanchang(date, coords, false, 'en');
  if (!panchang) return null;

  return {
    date: new Date(date),
    tithi: panchang.tithis[0]?.name ?? '',
    nakshatra: panchang.nakshatras[0]?.name ?? '',
    yoga: panchang.yogas[0]?.name ?? '',
    vara: panchang.vara ?? '',
    panchang,
    score: scored.score,
    reasons: scored.reasons ?? [],
  };
}
