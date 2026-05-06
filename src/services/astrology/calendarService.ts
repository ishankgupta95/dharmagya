import {
  getDailyPanchang,
  PanchangError,
  type AyanamsaType,
  type FestivalInfo,
  type FestivalRegion,
} from 'panchang-ts';

import festivalsData from '@/data/static/festivals.json';

// ─── Public types ────────────────────────────────────────────────────────────

export type CalendarFestivalType = FestivalInfo['type'];

export interface CalendarFestival {
  name: string;
  type: CalendarFestivalType;
  description?: string;
}

/**
 * One cell in the fullscreen month grid. Shape is intentionally narrow — the
 * grid renders directly off these fields, no per-cell `getPanchangam` call at
 * paint time.
 */
export interface CalendarDay {
  date: Date;
  /** Lunar day index, 0..29 across the synodic month. */
  tithi: number;
  paksha: 'shukla' | 'krishna';
  /** Empty for most days. Ekadashi sub-types are collapsed when both emit. */
  festivals: CalendarFestival[];
  ekadashi: boolean;
  sankranti: boolean;
  pournami: boolean;
  amavasya: boolean;
  pradosh: boolean;
  eclipse: 'solar' | 'lunar' | null;
  /** True when any festival on this day matches a slug in `selectedDeities`. */
  isUserDeityFestival: boolean;
  /** True when the daily panchang call diverged or threw — cell should render
   *  date number only, no markers. */
  failed: boolean;
}

export interface CalendarMonth {
  /** Calendar year of the requested month (Gregorian). */
  year: number;
  /** Month index 0..11. */
  month: number;
  /** 42 cells (6 rows × 7 cols) — Sunday-leading; includes overflow days. */
  cells: CalendarDay[];
}

export interface CalendarMonthOptions {
  region: FestivalRegion;
  ayanamsa: AyanamsaType;
  /** Deity slugs the user has marked as Isht; festivals matching these get
   *  re-ranked with `isUserDeityFestival: true`. */
  selectedDeities: string[];
}

// ─── LRU month cache ─────────────────────────────────────────────────────────
// Rolling 12-month cache. A single month is ~42 entries × ~120 bytes plus the
// festival arrays — well under 1MB for the full window.

const MONTH_CACHE = new Map<string, CalendarMonth>();
const MONTH_CACHE_MAX = 12;

// Inflight dedup so two callers asking for the same month during the initial
// async pass don't both walk the 42-day loop.
const PENDING = new Map<string, Promise<CalendarMonth>>();

function monthKey(
  year: number,
  month: number,
  lat: number,
  lon: number,
  region: FestivalRegion,
  ayanamsa: AyanamsaType,
  selectedDeities: string[],
): string {
  // selectedDeities is part of the key because `isUserDeityFestival` flips
  // on per-cell when the user changes their roster.
  const d = selectedDeities.length === 0 ? '_' : selectedDeities.slice().sort().join(',');
  return `${year}-${month}|${lat.toFixed(4)}|${lon.toFixed(4)}|${region}|${ayanamsa}|${d}`;
}

function lruSet<K, V>(map: Map<K, V>, k: K, v: V, max: number): void {
  if (map.has(k)) map.delete(k);
  map.set(k, v);
  if (map.size > max) {
    const first = map.keys().next().value as K;
    map.delete(first);
  }
}

function lruHit<K, V>(map: Map<K, V>, k: K): V | undefined {
  const v = map.get(k);
  if (v === undefined) return undefined;
  map.delete(k);
  map.set(k, v);
  return v;
}

// ─── Cell construction ───────────────────────────────────────────────────────

function buildCells(year: number, month: number): Date[] {
  // Sunday-leading 6×7 grid that mirrors `app/(tabs)/panchang.tsx` so cell
  // positions stay consistent between the small grid and the fullscreen view.
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Date[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevDays - i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length < 42) {
    const offset = cells.length - (firstDay + daysInMonth) + 1;
    cells.push(new Date(year, month + 1, offset));
  }
  return cells;
}

function normalizePaksha(p: string | undefined | null): 'shukla' | 'krishna' {
  if (!p) return 'shukla';
  const t = p.trim();
  if (t === 'Krishna' || t === 'कृष्ण') return 'krishna';
  return 'shukla';
}

function collapseEkadashi(list: readonly FestivalInfo[]): FestivalInfo[] {
  // Mirrors panchangService.mapFestivals — when the lib emits a sub-typed
  // ekadashi (smarta or vaishnava) on the same day as the generic 'ekadashi',
  // drop the generic so we don't double-render.
  const hasSubtype = list.some(
    f => f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  return list.filter(f => !(hasSubtype && f.type === 'ekadashi'));
}

// Festival → deity matchers. Patterns are kept narrow on purpose: a festival
// name has to actually carry the deity reference (e.g. "Ganesh Chaturthi",
// "Hanuman Jayanti") to flip `isUserDeityFestival`. Generic Ekadashis are
// treated as Vishnu-aligned because the fast itself is Vaishnava in origin.
const FESTIVAL_DEITY_PATTERNS: Record<string, RegExp[]> = {
  ganesha: [/ganesh/i, /sankashti/i, /vinayak/i, /chaturthi/i],
  shiva: [/shivaratri/i, /shivratri/i, /pradosh/i, /\bshiva\b/i, /shravan/i],
  vishnu: [/ekadashi/i, /vaikuntha/i, /\bvishnu\b/i, /narayan/i, /jagannath/i],
  hanuman: [/hanuman/i, /bajrang/i],
  lakshmi: [/lakshmi/i, /diwali/i, /deepavali/i, /sharad purnima/i, /dhanteras/i],
  krishna: [/krishna/i, /janmashtami/i, /gokul/i, /\bradha\b/i, /govardhan/i],
  rama: [/rama navami/i, /ram navami/i, /\brama\b/i, /vivaha panchami/i],
  durga: [/durga/i, /navratri/i, /navaratri/i, /dussehra/i, /vijayadashami/i, /durgashtami/i],
  saraswati: [/saraswati/i, /vasant panchami/i, /basant panchami/i],
  parvati: [/parvati/i, /\bgauri\b/i, /\bteej\b/i, /haritalika/i],
  kali: [/\bkali\b/i, /kalashtami/i],
  surya: [/chhath/i, /\bsurya\b/i, /makar sankranti/i, /pongal/i, /ratha saptami/i, /rath saptami/i],
  brahma: [/brahmotsav/i],
  'sai-baba': [/sai baba/i],
  'santoshi-mata': [/santoshi/i],
  sita: [/sita navami/i, /\bsita\b/i],
  'khatu-shyam': [/khatu/i],
  'vaishno-devi': [/vaishno/i],
  narasimha: [/narasimha/i, /narsimha/i],
};

function festivalMatchesDeity(
  f: { name: string; description?: string },
  deities: string[],
): boolean {
  if (deities.length === 0) return false;
  const haystack = `${f.name} ${f.description ?? ''}`;
  for (const slug of deities) {
    const patterns = FESTIVAL_DEITY_PATTERNS[slug];
    if (!patterns) continue;
    if (patterns.some(re => re.test(haystack))) return true;
  }
  return false;
}

// ─── Per-day compute ─────────────────────────────────────────────────────────

function computeDay(
  date: Date,
  coords: { lat: number; lon: number },
  region: FestivalRegion,
  ayanamsa: AyanamsaType,
  selectedDeities: string[],
): CalendarDay {
  const tz = -new Date().getTimezoneOffset();
  let result;
  try {
    // Fast pass: end-times disabled. The grid only needs sunrise tithi +
    // festivals + eclipse, so we save the tithi/nakshatra refinement work.
    result = getDailyPanchang(
      date,
      { latitude: coords.lat, longitude: coords.lon },
      {
        timezone: tz,
        computeEndTimes: false,
        language: 'en',
        region,
        ayanamsa,
      },
    );
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[calendar]', e.code, e.message);
    }
    result = null;
  }

  if (!result) {
    return {
      date,
      tithi: 0,
      paksha: 'shukla',
      festivals: [],
      ekadashi: false,
      sankranti: false,
      pournami: false,
      amavasya: false,
      pradosh: false,
      eclipse: null,
      isUserDeityFestival: false,
      failed: true,
    };
  }

  const sunriseTithi =
    result.tithis.find(t => t.isActiveAtSunrise) ?? result.tithis[0];
  const tithiIdx = sunriseTithi?.index ?? 0;
  const paksha = normalizePaksha(sunriseTithi?.paksha);
  // Pournami = last tithi of shukla paksha (number 15).
  // Amavasya = last tithi of krishna paksha (number 15).
  const pournami = paksha === 'shukla' && sunriseTithi?.number === 15;
  const amavasya = paksha === 'krishna' && sunriseTithi?.number === 15;

  const festivals = collapseEkadashi(result.festivals).map<CalendarFestival>(f => ({
    name: f.name,
    type: f.type,
    description: f.description,
  }));

  const ekadashi = festivals.some(
    f => f.type === 'ekadashi' || f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  const sankranti = festivals.some(f => f.type === 'sankranti');
  const pradosh = festivals.some(f => f.type === 'pradosha');
  const eclipse: 'solar' | 'lunar' | null = result.eclipse?.kind ?? null;
  const isUserDeityFestival =
    selectedDeities.length > 0 &&
    festivals.some(f => festivalMatchesDeity(f, selectedDeities));

  return {
    date,
    tithi: tithiIdx,
    paksha,
    festivals,
    ekadashi,
    sankranti,
    pournami,
    amavasya,
    pradosh,
    eclipse,
    isUserDeityFestival,
    failed: false,
  };
}

async function computeMonth(
  year: number,
  month: number,
  coords: { lat: number; lon: number },
  opts: CalendarMonthOptions,
): Promise<CalendarMonth> {
  const cells = buildCells(year, month);
  const out: CalendarDay[] = [];
  // Yield to the event loop every 14 cells so a cold month-build doesn't
  // monopolise the JS thread on Pixel 3a (42 × ~5ms = ~210ms worst case).
  const YIELD_EVERY = 14;
  for (let i = 0; i < cells.length; i++) {
    out.push(computeDay(cells[i], coords, opts.region, opts.ayanamsa, opts.selectedDeities));
    if ((i + 1) % YIELD_EVERY === 0 && i < cells.length - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
  return { year, month, cells: out };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the 42-cell calendar grid for `(year, month)` at `coords`. First call
 * for a key takes ~210ms on Pixel 3a (42 fast-pass panchang computes,
 * yielding every 14 days); subsequent calls hit the LRU and return synchronously
 * via the resolved Promise.
 */
export async function getCalendarMonth(
  year: number,
  month: number,
  coords: { lat: number; lon: number },
  opts: CalendarMonthOptions,
): Promise<CalendarMonth> {
  const key = monthKey(
    year,
    month,
    coords.lat,
    coords.lon,
    opts.region,
    opts.ayanamsa,
    opts.selectedDeities,
  );
  const hit = lruHit(MONTH_CACHE, key);
  if (hit) return hit;
  const inflight = PENDING.get(key);
  if (inflight) return inflight;
  const job = (async () => {
    try {
      const m = await computeMonth(year, month, coords, opts);
      lruSet(MONTH_CACHE, key, m, MONTH_CACHE_MAX);
      return m;
    } finally {
      PENDING.delete(key);
    }
  })();
  PENDING.set(key, job);
  return job;
}

/**
 * Synchronous cache peek — returns the resolved month if it's already in the
 * LRU, else null. The fullscreen calendar uses this to render instantly on a
 * back-swipe between recently-visited months without going through the
 * Promise round-trip.
 */
export function peekCalendarMonth(
  year: number,
  month: number,
  coords: { lat: number; lon: number },
  opts: CalendarMonthOptions,
): CalendarMonth | null {
  const key = monthKey(
    year,
    month,
    coords.lat,
    coords.lon,
    opts.region,
    opts.ayanamsa,
    opts.selectedDeities,
  );
  return lruHit(MONTH_CACHE, key) ?? null;
}

/**
 * Fire-and-forget prefetch of the previous + next month relative to `(year,
 * month)`. Subsequent swipes between adjacent months hit the LRU.
 */
export function prefetchAdjacentMonths(
  year: number,
  month: number,
  coords: { lat: number; lon: number },
  opts: CalendarMonthOptions,
): void {
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  void getCalendarMonth(prevYear, prevMonth, coords, opts);
  void getCalendarMonth(nextYear, nextMonth, coords, opts);
}

// ─── Yearly drilldowns (P9.3) ────────────────────────────────────────────────
// Drilldown lists ("Ekadashi this year", "Sankrantis this year", "Upcoming
// eclipses") read the pre-computed festivals.json bundled in `src/data/static`.
// The file covers 2016..2036 — see scripts/generate-festivals.js. Years outside
// that window return an empty list; callers can fall back to a per-month walk
// through `getCalendarMonth` if needed.

interface FestivalJsonRow {
  date: string;
  festivals: { name: string; type: string; description?: string }[];
}
const FESTIVAL_DATA = festivalsData as Record<string, FestivalJsonRow[]>;

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface EkadashiEntry {
  date: Date;
  name: string;
  description?: string;
}

export function getEkadashiForYear(year: number): EkadashiEntry[] {
  const rows = FESTIVAL_DATA[String(year)];
  if (!rows) return [];
  const out: EkadashiEntry[] = [];
  for (const row of rows) {
    for (const f of row.festivals) {
      if (
        f.type === 'ekadashi' ||
        f.type === 'smarta_ekadashi' ||
        f.type === 'vaishnava_ekadashi'
      ) {
        out.push({ date: parseYmd(row.date), name: f.name, description: f.description });
        break;
      }
    }
  }
  return out;
}

export interface SankrantiEntry {
  date: Date;
  name: string;
  description?: string;
}

export function getSankrantisForYearLocal(year: number): SankrantiEntry[] {
  const rows = FESTIVAL_DATA[String(year)];
  if (!rows) return [];
  const out: SankrantiEntry[] = [];
  for (const row of rows) {
    for (const f of row.festivals) {
      if (f.type === 'sankranti') {
        out.push({ date: parseYmd(row.date), name: f.name, description: f.description });
        break;
      }
    }
  }
  return out;
}

export interface UpcomingEclipseEntry {
  date: Date;
  kind: 'solar' | 'lunar';
  name: string;
  description?: string;
}

export function getUpcomingEclipsesLocal(
  fromDate: Date,
  lookaheadYears = 2,
): UpcomingEclipseEntry[] {
  const out: UpcomingEclipseEntry[] = [];
  const fromTime = fromDate.getTime();
  const fromY = fromDate.getFullYear();
  for (let y = fromY; y <= fromY + lookaheadYears; y++) {
    const rows = FESTIVAL_DATA[String(y)];
    if (!rows) continue;
    for (const row of rows) {
      const d = parseYmd(row.date);
      if (d.getTime() < fromTime) continue;
      for (const f of row.festivals) {
        if (f.type === 'eclipse') {
          // Detect kind from the name — festivals.json uses "Chandra Grahan
          // (Lunar Eclipse)" / "Surya Grahan (Solar Eclipse)" consistently.
          const kind: 'solar' | 'lunar' = /lunar|chandra/i.test(f.name) ? 'lunar' : 'solar';
          out.push({ date: d, kind, name: f.name, description: f.description });
        }
      }
    }
  }
  return out;
}
