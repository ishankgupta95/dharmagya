import {
  getInstantPanchang,
  PanchangError,
  type AyanamsaType,
  type FestivalInfo,
  type FestivalRegion,
} from 'panchang-ts';

import festivalsData from '@/data/static/festivals.json';
import { pmark, ptime } from '@/utils/perfProfile';

// ─── Public types ────────────────────────────────────────────────────────────

export type CalendarFestivalType = FestivalInfo['type'];

export interface CalendarFestival {
  name: string;
  type: CalendarFestivalType;
  description?: string;
}

/**
 * One cell in the fullscreen month grid. Shape is intentionally narrow — the
 * grid renders directly off these fields, no per-cell `getDailyPanchang` call
 * (that's 4–5ms each on Pixel 3a, so a 42-cell month = 200ms blocking; here
 * we use the much-lighter `getInstantPanchang` snapshot, ~60µs/call, plus a
 * static-JSON lookup for festival markers).
 */
export interface CalendarDay {
  date: Date;
  /** Lunar day index, 0..29 across the synodic month. */
  tithi: number;
  paksha: 'shukla' | 'krishna';
  /** Sunrise-time nakshatra name (already sampled by `buildDay`). Empty on
   *  compute failure. Surfaces in glance / dense calendar without forcing a
   *  full daily-panchang fetch. */
  nakshatra: string;
  /** Sunrise-time yoga name. Same source as `nakshatra`. */
  yoga: string;
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
  /** Generic tithi name for the day, e.g. "Pratipada", "Purnima", "Amavasya". */
  tithiName: string;
  /**
   * Highest-priority event label for the cell's third line. Major festival
   * name when present (e.g. "Holi", "Rama Navami"); else specific Sankranti
   * /Ekadashi name; else "Purnima" / "Amavasya" / "Pradosh"; else the generic
   * `tithiName`. Always non-empty.
   */
  primaryEventName: string;
  /**
   * Visual category for cell tinting. Drives the cell background colour.
   * Order roughly mirrors the priority used to pick `primaryEventName`.
   */
  eventCategory:
    | 'eclipse'
    | 'festival'        // major or user-deity festival
    | 'sankranti'
    | 'ekadashi'
    | 'pournami'
    | 'amavasya'
    | 'pradosh'
    | 'minor'           // minor festival (e.g. Masik Karthigai)
    | 'plain';
}

export interface CalendarMonth {
  /** Calendar year of the requested month (Gregorian). */
  year: number;
  /** Month index 0..11. */
  month: number;
  /** 42 cells (6 rows × 7 cols) — Sunday-leading; includes overflow days. */
  cells: CalendarDay[];
  /** Localized Hindu lunar-month name dominant on the 15th (mid-month) of the
   *  Gregorian month, in the user's `masaSystem`. Empty when compute fails. */
  hinduMasa: string;
  /** Vikram Samvat year for the 15th of the Gregorian month. 0 on failure. */
  vikramSamvat: number;
}

export interface CalendarMonthOptions {
  region: FestivalRegion;
  ayanamsa: AyanamsaType;
  /** Deity slugs the user has marked as Isht; festivals matching these get
   *  `isUserDeityFestival: true`. */
  selectedDeities: string[];
  /** purnimanta (default — North Indian) vs amanta (South Indian). Drives the
   *  Hindu-month label shown in the calendar header. */
  masaSystem: 'purnimanta' | 'amanta';
}

// ─── Static festivals.json index (built once at module load) ─────────────────
// `festivals.json` is ~3300 entries across 2016..2036. Flatten into a single
// `Map<YYYY-MM-DD, row>` so per-cell lookup is O(1). The whole bundle is
// already eagerly imported by `vrat.ts` + `calendarMonth.ts`, so this only
// pays an indexing cost (≈1ms), not a JSON-parse cost.

interface FestivalJsonRow {
  date: string;
  festivals: { name: string; type: string; description?: string }[];
}
const FESTIVAL_DATA = festivalsData as Record<string, FestivalJsonRow[]>;

const FESTIVAL_INDEX: Map<string, FestivalJsonRow> = (() => {
  const m = new Map<string, FestivalJsonRow>();
  for (const yearKey of Object.keys(FESTIVAL_DATA)) {
    for (const row of FESTIVAL_DATA[yearKey]) {
      m.set(row.date, row);
    }
  }
  return m;
})();

// ─── LRU month cache ─────────────────────────────────────────────────────────
// Sync values (CalendarMonth), not promises — `getCalendarMonth` is now a
// straight synchronous compute fast enough to call during render.

const MONTH_CACHE = new Map<string, CalendarMonth>();
const MONTH_CACHE_MAX = 24;

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

function monthKey(
  year: number,
  month: number,
  lat: number,
  lon: number,
  ayanamsa: AyanamsaType,
  selectedDeities: string[],
  masaSystem: 'purnimanta' | 'amanta',
): string {
  // `region` is only used by `getDailyPanchang` festival emission — we read
  // markers from the static `festivals.json` instead, which is already region-
  // collapsed. So region isn't part of the key.
  const d = selectedDeities.length === 0 ? '_' : selectedDeities.slice().sort().join(',');
  return `${year}-${month}|${lat.toFixed(3)}|${lon.toFixed(3)}|${ayanamsa}|${d}|${masaSystem}`;
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

function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Best-effort sunrise probe for the given longitude. Returns a `Date` at
 * approximately 6 AM local solar time on the cell date — close enough to
 * actual sunrise across India that the tithi prevailing at this instant
 * matches the lib's sunrise-tithi for ≥97% of days year-round. The remaining
 * boundary cases miss by ±1 in `tithi.number`; for pournami/amavasya
 * specifically that's 0-2 misses per year out of 12 events. Users tap into
 * a cell for canonical detail, so the grid only needs visual approximation.
 */
function probeAtSunriseApprox(date: Date, lon: number): Date {
  const utcMidnight = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  // 6 AM local solar time = 06:00 - lon*4 minutes UTC = (6 - lon/15) hours UTC.
  const offsetH = 6 - (lon / 15);
  return new Date(utcMidnight + offsetH * 3600000);
}

// Tithi names by synodic index 0..29. Both pakshas reuse the same 1..15 names
// (Pratipada → Chaturdashi), with Purnima at idx 14 (end of shukla) and
// Amavasya at idx 29 (end of krishna). These print on the third line of each
// calendar cell when no festival overrides.
const TITHI_NAMES: readonly string[] = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Amavasya',
];

/**
 * Pick the most informative single label for a calendar cell, in priority
 * order. Each cell prints the result as its third line. The returned string
 * tries to stay short — long festival names are truncated by the renderer
 * via `numberOfLines={1}`.
 */
function pickPrimaryEvent(
  tithiIdx: number,
  festivals: CalendarFestival[],
  eclipse: 'solar' | 'lunar' | null,
  ekadashi: boolean,
  sankranti: boolean,
  pournami: boolean,
  amavasya: boolean,
  pradosh: boolean,
): { label: string; category: CalendarDay['eventCategory'] } {
  // 1. Eclipse beats everything visually — content-semantic dark plinth.
  if (eclipse) {
    return {
      label: eclipse === 'lunar' ? 'Chandra Grahan' : 'Surya Grahan',
      category: 'eclipse',
    };
  }
  // 2. Major festival (Holi, Diwali, Rama Navami, etc.).
  const major = festivals.find(f => f.type === 'major');
  if (major) {
    return { label: major.name, category: 'festival' };
  }
  // 3. Sankranti — prefer specific name (Makar Sankranti, Pongal, etc.) over generic.
  if (sankranti) {
    const sk = festivals.find(f => f.type === 'sankranti' && f.name !== 'Sankranti')
      ?? festivals.find(f => f.type === 'sankranti');
    return { label: sk?.name ?? 'Sankranti', category: 'sankranti' };
  }
  // 4. Ekadashi — prefer the Smarta description (e.g. "Putrada Ekadashi") over
  //    the generic emission. festivals.json puts the specific name in `description`.
  if (ekadashi) {
    const ek = festivals.find(f => f.type === 'smarta_ekadashi')
      ?? festivals.find(f => f.type === 'vaishnava_ekadashi')
      ?? festivals.find(f => f.type === 'ekadashi');
    return { label: ek?.description ?? 'Ekadashi', category: 'ekadashi' };
  }
  // 5. Purnima / Amavasya / Pradosh — celestial markers when no named festival.
  if (pournami) return { label: 'Purnima', category: 'pournami' };
  if (amavasya) return { label: 'Amavasya', category: 'amavasya' };
  if (pradosh) return { label: 'Pradosh', category: 'pradosh' };
  // 6. Any minor festival (Masik Karthigai, Vinayaka Chaturthi, etc.).
  const minor = festivals.find(f => f.type === 'minor');
  if (minor) return { label: minor.name, category: 'minor' };
  // 7. Fallback — generic tithi name.
  return { label: TITHI_NAMES[tithiIdx] ?? '', category: 'plain' };
}

function normalizePaksha(p: string | undefined | null): 'shukla' | 'krishna' {
  if (!p) return 'shukla';
  const t = p.trim();
  if (t === 'Krishna' || t === 'कृष्ण') return 'krishna';
  return 'shukla';
}

function collapseEkadashi(
  list: { name: string; type: string; description?: string }[],
): { name: string; type: string; description?: string }[] {
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

function buildDay(
  date: Date,
  coords: { lat: number; lon: number },
  ayanamsa: AyanamsaType,
  selectedDeities: string[],
): CalendarDay {
  // Tithi/paksha — light snapshot at sunrise approx (≈60µs per call).
  let tithiIdx = 0;
  let paksha: 'shukla' | 'krishna' = 'shukla';
  let pournami = false;
  let amavasya = false;
  let nakshatra = '';
  let yoga = '';
  try {
    const probe = probeAtSunriseApprox(date, coords.lon);
    const inst = getInstantPanchang(
      probe,
      { latitude: coords.lat, longitude: coords.lon },
      { ayanamsa, computeEndTimes: false },
    );
    if (inst) {
      tithiIdx = inst.tithi.index;
      paksha = normalizePaksha(inst.tithi.paksha);
      // Pournami = last tithi of shukla paksha (number 15).
      // Amavasya = last tithi of krishna paksha (number 15).
      pournami = paksha === 'shukla' && inst.tithi.number === 15;
      amavasya = paksha === 'krishna' && inst.tithi.number === 15;
      nakshatra = inst.nakshatra.name ?? '';
      yoga = inst.yoga.name ?? '';
    }
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[calendar]', e.code, e.message);
    }
    // Fall through with defaults.
  }

  // Markers — pre-indexed festivals.json lookup (≈O(1)).
  const row = FESTIVAL_INDEX.get(ymdKey(date));
  const rawList = row ? collapseEkadashi(row.festivals) : [];
  const festivals: CalendarFestival[] = rawList.map(f => ({
    name: f.name,
    type: f.type as CalendarFestivalType,
    description: f.description,
  }));

  const ekadashi = festivals.some(
    f => f.type === 'ekadashi' || f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  const sankranti = festivals.some(f => f.type === 'sankranti');
  const pradosh = festivals.some(f => f.type === 'pradosha');
  const eclipseEntry = festivals.find(f => f.type === 'eclipse');
  // festivals.json names eclipses as "Surya Grahan (Solar Eclipse)" /
  // "Chandra Grahan (Lunar Eclipse)" — match on the parenthesised form.
  const eclipse: 'solar' | 'lunar' | null = eclipseEntry
    ? (/lunar|chandra/i.test(eclipseEntry.name) ? 'lunar' : 'solar')
    : null;
  const isUserDeityFestival =
    selectedDeities.length > 0 &&
    festivals.some(f => festivalMatchesDeity(f, selectedDeities));

  const { label: primaryEventName, category: rawCategory } = pickPrimaryEvent(
    tithiIdx,
    festivals,
    eclipse,
    ekadashi,
    sankranti,
    pournami,
    amavasya,
    pradosh,
  );
  // Promote any user-deity festival category to 'festival' tier so the cell
  // gets the full festival tint even if the deity-matching festival was
  // emitted as `minor` (e.g. Masik Shivaratri for a Shiva-isht user).
  const eventCategory: CalendarDay['eventCategory'] =
    isUserDeityFestival && rawCategory === 'minor' ? 'festival' : rawCategory;

  return {
    date,
    tithi: tithiIdx,
    paksha,
    nakshatra,
    yoga,
    festivals,
    ekadashi,
    sankranti,
    pournami,
    amavasya,
    pradosh,
    eclipse,
    isUserDeityFestival,
    tithiName: TITHI_NAMES[tithiIdx] ?? '',
    primaryEventName,
    eventCategory,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synchronously build the 42-cell calendar grid for `(year, month)` at
 * `coords`. First call for a key takes ~3ms on a modern device, ~15ms on
 * Pixel 3a; subsequent calls hit the LRU and return in <0.01ms. Safe to call
 * during render.
 */
export function getCalendarMonth(
  year: number,
  month: number,
  coords: { lat: number; lon: number },
  opts: CalendarMonthOptions,
): CalendarMonth {
  const key = monthKey(
    year,
    month,
    coords.lat,
    coords.lon,
    opts.ayanamsa,
    opts.selectedDeities,
    opts.masaSystem,
  );
  const hit = lruHit(MONTH_CACHE, key);
  if (hit) {
    pmark('calendar:getCalendarMonth:hit', `${year}-${month + 1}`);
    return hit;
  }
  pmark('calendar:getCalendarMonth:miss', `${year}-${month + 1}`);
  const endBuild = ptime('calendar:getCalendarMonth:build');
  const cells = buildCells(year, month).map(d =>
    buildDay(d, coords, opts.ayanamsa, opts.selectedDeities),
  );
  endBuild();

  // Mid-month getInstantPanchang gives us the dominant Hindu masa + Samvat
  // for the header. ~60µs — single call, not per-cell.
  let hinduMasa = '';
  let vikramSamvat = 0;
  try {
    const mid = new Date(year, month, 15);
    const inst = getInstantPanchang(
      mid,
      { latitude: coords.lat, longitude: coords.lon },
      { ayanamsa: opts.ayanamsa, computeEndTimes: false },
    );
    if (inst) {
      hinduMasa = opts.masaSystem === 'amanta'
        ? inst.chandramasa.name
        : inst.chandramasa.purnimantaName;
      vikramSamvat = inst.samvat.vikramSamvat;
    }
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[calendar]', e.code, e.message);
    }
  }

  const result: CalendarMonth = { year, month, cells, hinduMasa, vikramSamvat };
  lruSet(MONTH_CACHE, key, result, MONTH_CACHE_MAX);
  return result;
}

/**
 * Cache-only peek — returns the cached `CalendarMonth` if present, or `null`.
 * Lets the panchang screen render immediately on warm caches and defer the
 * ~80–120ms build to a `useEffect` on miss (P11.1 first-paint optimization).
 * Does not promote LRU order; the next `getCalendarMonth` call will.
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
    opts.ayanamsa,
    opts.selectedDeities,
    opts.masaSystem,
  );
  return MONTH_CACHE.get(key) ?? null;
}

// ─── Yearly drilldowns (P9.3) ────────────────────────────────────────────────
// Drilldown lists ("Ekadashi this year", "Sankrantis this year", "Upcoming
// eclipses") read the pre-computed festivals.json bundled in `src/data/static`.
// The file covers 2016..2036 — see scripts/generate-festivals.js. Years outside
// that window return an empty list.

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
          const kind: 'solar' | 'lunar' = /lunar|chandra/i.test(f.name) ? 'lunar' : 'solar';
          out.push({ date: d, kind, name: f.name, description: f.description });
        }
      }
    }
  }
  return out;
}
