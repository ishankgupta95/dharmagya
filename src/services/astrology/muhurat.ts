import {
  scoreMuhurta,
  vivahRule,
  grihaPraveshRule,
  namakaranaRule,
  vahanKharidiRule,
  mundanRule,
  annaprashanRule,
  vidyarambhRule,
  type AyanamsaType,
  type MuhurtaFactor,
  type MuhurtaRule,
} from 'panchang-ts';
import {
  fetchPanchang,
  noonAtPlace,
  panchangTimezoneMinutes,
  FALLBACK_COORDS,
  type PanchangCoords,
} from './panchangService';

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
// Muhurta-chintamani, Muhurta-darpana, BPHS Ch. 28 (see panchang-ts dist for
// the per-rule citations).
const OCCASION_TO_RULE: Record<Occasion, MuhurtaRule> = {
  vivah: vivahRule,
  'griha-pravesh': grihaPraveshRule,
  namkaran: namakaranaRule,
  vahan: vahanKharidiRule,
  mundan: mundanRule,
  annaprashan: annaprashanRule,
  vidyarambh: vidyarambhRule,
};

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
  /** Only the windows the muhurat card actually renders, so the UI needs no
   *  second fetch. Deliberately NOT the whole `IPanchangDay`: that embedded a
   *  ~10 KB object per matching day, i.e. ~2.4 MB per cached occasion row and
   *  ~16 MB once all seven have been opened, ~80% of which (do-ghati, gowri,
   *  hora, every anga array) no muhurat surface has ever read — and the whole
   *  blob was re-stringified into SQLite on every occasion switch. */
  windows: MuhuratDayWindows;
  /** Library's auspiciousness score [0..100] from `scoreMuhurta`. Higher is
   *  more auspicious. Always present for fresh writes; the SQLite cache is
   *  wiped by a `user_version` rung whenever the scoring inputs — or a window
   *  the finder displays from the cached row, such as Brahma Muhurta — move
   *  (v14 at time of writing, see src/utils/database.ts), so no stale rows
   *  linger. */
  score: number;
  /** Why the score landed where it did, in structured form — one entry per
   *  scoring rule that fired. `factor.code` keys an i18n string and
   *  `factor.axis` says which anga to name, which is what the "Why this day"
   *  list in the expanded day detail renders. */
  factors: MuhurtaFactor[];
  /** The library's English developer diagnostics for the same list. Kept only
   *  as a last-resort fallback for a `code` we have no string for yet — the
   *  library documents these as unlocalized and not a stable format, so they
   *  must never be what a user sees by default. */
  reasons: string[];
}

/** The subset of a day's panchang the muhurat card renders. */
export interface MuhuratDayWindows {
  rahuKalamStart?: string;
  rahuKalamEnd?: string;
  abhijitMuhurtaStart?: string;
  abhijitMuhurtaEnd?: string;
  brahmaMuhurtaStart?: string;
  brahmaMuhurtaEnd?: string;
  /** Day choghadiya, pre-filtered to the auspicious slots the card lists. */
  auspiciousChoghadiya: { name: string; start: string; end: string }[];
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
  coords?: PanchangCoords | null;
  /** Sidereal convention. Required rather than defaulted: the muhurat screen
   *  used to silently score every user under Lahiri while the Panchang tab
   *  honoured their setting, which put a different nakshatra on the two
   *  screens for the same date (36 days a year under Raman) and flipped
   *  pass/fail on 33. An optional field would re-open that hole one layer up. */
  ayanamsa: AyanamsaType;
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
  coords?: PanchangCoords | null;
  /** See `ScanOptions.ayanamsa`. */
  ayanamsa: AyanamsaType;
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

    const match = await evaluateAndDescribe(date, rule, opts.coords ?? null, opts.ayanamsa);
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

    const match = await evaluateAndDescribe(new Date(cursor), rule, opts.coords ?? null, opts.ayanamsa);
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
  coords: PanchangCoords | null,
  ayanamsa: AyanamsaType,
): Promise<MuhuratMatch | null> {
  // Resolve the location once and hand the identical value to both calls.
  // `scoreMuhurta` needs a real GeoLocation, and left to itself `fetchPanchang`
  // would resolve the null case independently — a live GPS fix when permission
  // happens to be granted, otherwise Ujjain. Scoring one place while
  // describing another is a real divergence, not a rounding error: at the
  // ~1000 km between the old Pune literal and `FALLBACK_COORDS` the two
  // disagree on score or pass for 11–19 candidate days a year per occasion.
  // `FALLBACK_COORDS` is the app-wide no-location default (see
  // `useLazyDailyPanchang` and the location settings copy, which names
  // Ujjain to the user); passing it explicitly also spares a GPS fix on
  // every matching day of a 365-day scan.
  const resolved = coords ?? FALLBACK_COORDS;
  const location = { latitude: resolved.lat, longitude: resolved.lon };
  // The offset belongs to the place and the day, not to the phone right now —
  // see `panchangTimezoneMinutes`. Resolving it per-day (rather than once at
  // call time, as this file used to) keeps scoring and rendering on the same
  // offset across a DST boundary mid-scan, which was the original worry: both
  // sides now derive it identically, so they cannot disagree. Measured, the
  // 60-minute delta changes no scores (0 of 133 cross-DST days), so this is
  // about staying aligned with what the card prints, not about scoring.
  const timezone = panchangTimezoneMinutes(resolved, date);
  // `date` is device-local noon of the civil day being scanned (built by
  // `validateCandidates` / `scanAuspiciousDays`), but `scoreMuhurta` picks the
  // Hindu day off that instant in `timezone`, the place's offset. Device noon
  // at or west of −06:30 is already past midnight IST, so a Pacific phone scored
  // day D+1 while `MuhuratMatch.date` and the bundled candidate (generated at
  // Ujjain for day D) said D. Re-anchor to noon of the same civil date in the
  // place's zone — see `noonAtPlace`. `fetchPanchang` below does the same to
  // the civil `date` it is handed, so both sides still read one Hindu day.
  const at = noonAtPlace(date, timezone);

  let scored;
  try {
    scored = scoreMuhurta(at, location, rule, { timezone, ayanamsa });
  } catch {
    return null;
  }
  if (!scored.passes) return null;

  const panchang = await fetchPanchang(date, resolved, false, 'en', 'all', undefined, undefined, ayanamsa);
  if (!panchang) return null;

  // Same coords, same offset, same ayanamsa and same anchored instant on both
  // sides, so `panchang.tithis[0]` etc. are the very elements `scoreMuhurta`
  // read at sunrise — which is what lets the UI name a factor's anga from these
  // fields instead of maintaining its own index→name table against
  // `factor.index`.
  return {
    date: new Date(date),
    tithi: panchang.tithis[0]?.name ?? '',
    nakshatra: panchang.nakshatras[0]?.name ?? '',
    yoga: panchang.yogas[0]?.name ?? '',
    vara: panchang.vara ?? '',
    windows: {
      rahuKalamStart: panchang.rahuKalamStart,
      rahuKalamEnd: panchang.rahuKalamEnd,
      abhijitMuhurtaStart: panchang.abhijitMuhurtaStart,
      abhijitMuhurtaEnd: panchang.abhijitMuhurtaEnd,
      brahmaMuhurtaStart: panchang.brahmaMuhurtaStart,
      brahmaMuhurtaEnd: panchang.brahmaMuhurtaEnd,
      auspiciousChoghadiya: (panchang.choghadiya?.day ?? [])
        .filter(s => s.quality === 'auspicious')
        .slice(0, 3)
        .map(s => ({ name: s.name, start: s.start, end: s.end })),
    },
    score: scored.score,
    factors: scored.factors,
    reasons: scored.reasons,
  };
}
