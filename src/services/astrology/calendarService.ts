import {
  computeEclipsesInRange,
  getInstantPanchang,
  getSunrise,
  PanchangError,
  type AyanamsaType,
  type FestivalInfo,
  type FestivalRegion,
} from 'panchang-ts';

import festivalsData, { festivalsForDay } from '@/data/festivals';
import { pickHeadlineMajor } from '@/utils/festivalHeadline';
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
  /** Lunar day index, 0..29 across the synodic month. `-1` on compute failure. */
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
  /** Generic tithi name for the day, e.g. "Pratipada", "Purnima", "Amavasya".
   *  Empty on compute failure, same as `nakshatra` / `yoga`. */
  tithiName: string;
  /**
   * Highest-priority event label for the cell's third line. Major festival
   * name when present (e.g. "Holi", "Rama Navami"); else specific Sankranti
   * /Ekadashi name; else "Purnima" / "Amavasya" / "Pradosh"; else the generic
   * `tithiName`. Empty only when the day's snapshot failed to compute.
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
  /** Scopes region-specific festivals (Pongal, Lohri, Gudi Padwa, Bihu, …).
   *  The bundled table is generated at `'all'`, so this is applied per row at
   *  read time via `festivalsForDay`. `'all'` keeps every regional variant. */
  region: FestivalRegion;
  ayanamsa: AyanamsaType;
  /** Deity slugs the user has marked as Isht; festivals matching these get
   *  `isUserDeityFestival: true`. */
  selectedDeities: string[];
  /** purnimanta (default — North Indian) vs amanta (South Indian). Drives the
   *  Hindu-month label shown in the calendar header, and — since panchang-ts
   *  5.4 — the days of the month-system-dependent observances (Shravan Somvar,
   *  Mangala Gauri, Kartik Somvar, Magha Shanivar) via `festivalsForDay`. */
  masaSystem: 'purnimanta' | 'amanta';
}

// ─── Festival index (built lazily, one civil year at a time) ─────────────────
// `festivalsData` is the panchang-ts festival table, year-keyed (see
// `src/data/festivals.ts`). Flatten into a single `Map<YYYY-MM-DD, row>` so
// per-cell lookup is O(1). Eclipses are not in this table (the lib excludes
// them — visibility is location-dependent); they're sourced live per-month via
// `eclipsesForCells` below.
//
// WHY LAZY, AND WHY IT MATTERS HERE SPECIFICALLY. `src/data/festivals.ts`
// decodes its rows per year on first access and caches them, so nothing pays
// for a year it never reads. This module used to defeat that entirely: it built
// the flat index in a module-scope IIFE that walked `Object.keys(FESTIVAL_DATA)`,
// and the proxy's `ownKeys` trap has to decode EVERY year to answer that (8
// years / ~1,250 rows as shipped). `app/(tabs)/panchang.tsx` imports this module
// statically, so the (tabs) layout pulled the whole decode onto the pre-paint
// tick — the deferral existed on paper only.
//
// So ingest per year, on demand, driven by the dates actually looked up. A
// 42-cell month grid spans at most two civil years, so a cold Panchang open
// decodes 1–2 years instead of all 8, and that stays true as the table's rolling
// window grows. Rows are keyed by `row.date` (not by the year key they arrived
// under), so ingesting a year can only ever ADD entries the old flat map also
// had — contents are identical once the same years are in.

interface FestivalJsonRow {
  date: string;
  festivals: { key: string; name: string; type: string; description?: string }[];
}
// Deliberately `| undefined` on the value: the proxy in `src/data/festivals.ts`
// returns `undefined` for any year outside the table's range, which a plain
// `Record<string, T[]>` would let us dereference blind.
const FESTIVAL_DATA = festivalsData as Record<string, FestivalJsonRow[] | undefined>;

const FESTIVAL_INDEX = new Map<string, FestivalJsonRow>();
/** Years already folded into `FESTIVAL_INDEX`. Holds out-of-range years too, so
 *  a repeatedly-visited empty year costs one proxy read, not one per cell. One
 *  small number per year the user has navigated to — bounded in practice by how
 *  far the calendar is scrolled. */
const INDEXED_YEARS = new Set<number>();

/**
 * How close to Jan 1 / Dec 31 a date has to be for the adjacent year's rows to
 * be ingested as well.
 *
 * The shipped table files every row under its own date's year (verified: 1,254
 * rows, zero mismatches, zero cross-year duplicate dates), and the generator
 * builds it a year at a time via the library's `buildFestivalsTable`, so this
 * guard is belt-and-braces rather than a live requirement. It exists because the
 * table is REGENERATED on every panchang-ts bump: if a festival whose date is
 * computed near the boundary ever lands in the neighbouring year's array, a
 * strictly own-year lookup would silently drop it — a blank day rather than a
 * visible error, which is the failure mode this file is least able to notice.
 * A week of slack covers any plausible misfiling, and it is close to free: a
 * month grid that contains a boundary date already spans both years, so it was
 * going to decode both anyway.
 */
const YEAR_BOUNDARY_SLACK_DAYS = 7;

function indexYear(year: number): void {
  if (INDEXED_YEARS.has(year)) return;
  // Mark BEFORE reading: an out-of-range year legitimately yields no rows, and
  // it must still count as ingested or every miss re-runs the proxy lookup.
  INDEXED_YEARS.add(year);
  const rows = FESTIVAL_DATA[String(year)];
  if (!rows) return;
  for (const row of rows) FESTIVAL_INDEX.set(row.date, row);
}

/** The festival-table row for `date`, ingesting whatever year(s) that lookup
 *  depends on first. */
function festivalRow(date: Date): FestivalJsonRow | undefined {
  const year = date.getFullYear();
  indexYear(year);
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 0 && day <= YEAR_BOUNDARY_SLACK_DAYS) {
    indexYear(year - 1);
  } else if (month === 11 && day > 31 - YEAR_BOUNDARY_SLACK_DAYS) {
    indexYear(year + 1);
  }
  return FESTIVAL_INDEX.get(ymdKey(date));
}

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
  region: FestivalRegion,
): string {
  // The pre-computed festival table is built with `region: 'all'` — the most
  // inclusive setting — and `purnimanta`, so region and month system are
  // applied per row at READ time via `festivalsForDay` (see `buildDay`). That
  // makes both real inputs to the cells, so they have to be part of the cache
  // key or a region / month-system change serves a stale month.
  const d = selectedDeities.length === 0 ? '_' : selectedDeities.slice().sort().join(',');
  return `${year}-${month}|${lat.toFixed(3)}|${lon.toFixed(3)}|${ayanamsa}|${d}|${masaSystem}|${region}`;
}

// ─── LRU sunrise-probe cache ─────────────────────────────────────────────────
// The month LRU alone throws away a lot of work. Two reasons, both measured:
//  (a) adjacent 42-cell grids overlap — across the 12 month steps of a year an
//      average of ~12 of 42 cells are shared with the previous grid;
//  (b) `monthKey` embeds `region` + `masaSystem`, neither of which touches the
//      ephemeris (both only reshape FESTIVAL_INDEX rows, and masaSystem also
//      picks between two already-computed strings), so toggling either evicted
//      every month and re-ran all 84 ephemeris calls.
// So cache the expensive half separately, keyed on exactly what it depends on:
// the calendar day, the coordinates and the ayanamsa. `probeAtSunrise` +
// `getInstantPanchang` are pure over those four (the polar-night fallback is a
// deterministic solar-time formula), so the entry is safe to reuse — including
// the failure shape, which is likewise deterministic for the same inputs.
// ~200 entries ≈ 5 months of grids, a few KB.

interface ProbeResult {
  tithiIdx: number;
  paksha: 'shukla' | 'krishna';
  pournami: boolean;
  amavasya: boolean;
  nakshatra: string;
  yoga: string;
}

const PROBE_CACHE = new Map<string, ProbeResult>();
const PROBE_CACHE_MAX = 200;

function probeKey(
  date: Date,
  lat: number,
  lon: number,
  ayanamsa: AyanamsaType,
): string {
  return `${ymdKey(date)}|${lat.toFixed(3)}|${lon.toFixed(3)}|${ayanamsa}`;
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
 * Eclipses for a calendar grid window, sourced live from panchang-ts (the
 * bundled festival table excludes eclipses by design — visibility is
 * location-dependent). Computed once per month build (cache miss only), not
 * per cell. Consecutive same-kind eclipses are NOT always months apart:
 * penumbral lunar pairs one lunation (~29.5 days) apart do land inside one
 * 42-day grid (2020-06-06/07-05, 2031-05-07/06-05, 2056-06-27/07-27), so the
 * whole window is enumerated rather than taking one lookahead per kind — a
 * single lookahead silently dropped the second. Peak instants are mapped to
 * their device-local calendar day to match the grid's device-local cells
 * (mirrors `eclipseDateOf` in panchangService).
 */
function eclipsesForCells(
  cellDates: Date[],
  coords: { lat: number; lon: number },
): Map<string, 'solar' | 'lunar'> {
  const map = new Map<string, 'solar' | 'lunar'>();
  if (cellDates.length === 0) return map;
  const first = cellDates[0];
  // Each cell date is that day's local midnight, so the range has to run one
  // day past the last cell to cover the whole final cell.
  const end = new Date(cellDates[cellDates.length - 1].getTime() + 86_400_000);
  try {
    const eclipses = computeEclipsesInRange(first, end, {
      latitude: coords.lat,
      longitude: coords.lon,
    });
    for (const e of eclipses) {
      const k = ymdKey(new Date(e.peak));
      // Solar takes a shared day (it is the one that carries sutak); otherwise
      // the first peak of that day claims the cell.
      if (e.kind === 'solar' || !map.has(k)) map.set(k, e.kind);
    }
  } catch (e) {
    if (e instanceof PanchangError) console.warn('[calendar]', e.code, e.message);
  }
  return map;
}

/**
 * The instant to sample the cell's tithi / nakshatra / yoga at: the day's real
 * sunrise, plus a few seconds so a boundary lands inside the anga rather than
 * on its edge.
 *
 * A fixed "6 AM local solar time" stand-in used to be good enough for a purely
 * decorative grid, but the cell's own label is now what the tapped-day headline
 * prints, so an off-by-one tithi shows up as (say) two consecutive "Amavasya"
 * cells and a headline that contradicts the Pancha Anga row two reveals below.
 * Real sunrise swings ~±45 min across the year, which is exactly the band the
 * fixed probe got wrong.
 *
 * `getSunrise` throws under midnight sun / polar night, so keep the solar-time
 * approximation as the fallback: an approximate cell is better than a blank one.
 */
function probeAtSunrise(date: Date, coords: { lat: number; lon: number }): Date {
  const utcMidnight = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  // Local solar midnight = 00:00 - lon*4 minutes UTC; search forward from there
  // so the first sunrise found is this calendar day's.
  const solarMidnight = new Date(utcMidnight - (coords.lon / 15) * 3600000);
  try {
    return new Date(
      getSunrise(solarMidnight, { latitude: coords.lat, longitude: coords.lon }).getTime() + 30_000,
    );
  } catch {
    // 6 AM local solar time = 06:00 - lon*4 minutes UTC = (6 - lon/15) hours UTC.
    return new Date(utcMidnight + (6 - coords.lon / 15) * 3600000);
  }
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
  // 1. Major festival (Holi, Diwali, Rama Navami, etc.) — the cultural anchors.
  //    These trump eclipses for the headline because that's what users open the
  //    calendar to find. Eclipse co-occurrences (Holika Dahan 2026 on a lunar
  //    eclipse, etc.) are still surfaced via `CalendarDay.eclipse` so the
  //    FlagStrip / day detail can flag them — just not as the primary label.
  //
  //    When multiple majors share a day (e.g. Diwali + Narak Chaturdashi on
  //    2026-11-08, Durga Ashtami + Maha Navami in some years), pick the
  //    higher-recognition one via `HEADLINE_MAJORS`. Falls back to the first
  //    major in the array when none are ranked.
  const majors = festivals.filter(f => f.type === 'major');
  if (majors.length > 0) {
    return { label: pickHeadlineMajor(majors).name, category: 'festival' };
  }
  // 2. Eclipse — content-semantic dark plinth when no major festival overlaps.
  if (eclipse) {
    return {
      label: eclipse === 'lunar' ? 'Chandra Grahan' : 'Surya Grahan',
      category: 'eclipse',
    };
  }
  // 3. Sankranti — prefer specific name (Makar Sankranti, Pongal, etc.) over generic.
  if (sankranti) {
    const sk = festivals.find(f => f.type === 'sankranti' && f.name !== 'Sankranti')
      ?? festivals.find(f => f.type === 'sankranti');
    return { label: sk?.name ?? 'Sankranti', category: 'sankranti' };
  }
  // 4. Ekadashi — prefer the Smarta description (e.g. "Putrada Ekadashi") over
  //    the generic emission. The festival table puts the specific name in
  //    `description`.
  if (ekadashi) {
    const ek = festivals.find(f => f.type === 'smarta_ekadashi')
      ?? festivals.find(f => f.type === 'vaishnava_ekadashi')
      ?? festivals.find(f => f.type === 'ekadashi');
    // On a viddha / vriddha day the library puts a whole explanatory sentence
    // in `description` instead of the classical name ("Dashami-viddha
    // Ekadashi: Vaishnava fast observed today (Dwadashi)."), which then
    // rendered as a clipped English headline in both languages. Only promote
    // it when it reads as a name; otherwise fall back to the generic marker,
    // which `localizePrimaryEvent` can translate. Nothing is lost — the
    // sentence itself still renders, localized, in the flag strip below.
    const desc = ek?.description?.trim();
    return {
      label: desc && /ekadashi$/i.test(desc) ? desc : 'Ekadashi',
      category: 'ekadashi',
    };
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

/**
 * The two ephemeris calls behind a cell — sunrise, then the instant snapshot at
 * it — memoized in `PROBE_CACHE`. This is the whole expensive half of a cell;
 * everything below it in `buildDay` is a Map lookup and some string picking.
 */
function probeDay(
  date: Date,
  coords: { lat: number; lon: number },
  ayanamsa: AyanamsaType,
): ProbeResult {
  const key = probeKey(date, coords.lat, coords.lon, ayanamsa);
  const cached = lruHit(PROBE_CACHE, key);
  if (cached) return cached;

  // Tithi/paksha — light snapshot at the day's sunrise (≈60µs per call).
  // -1 means "not computed": the probe can legitimately fail (polar night), and
  // defaulting to 0 published a fabricated "Pratipada / Shukla" that the cell
  // and the glance line then printed as fact next to a "Calculation failed"
  // detail pane. Emitting an empty name matches `nakshatra` / `yoga`.
  let tithiIdx = -1;
  let paksha: 'shukla' | 'krishna' = 'shukla';
  let pournami = false;
  let amavasya = false;
  let nakshatra = '';
  let yoga = '';
  try {
    const probe = probeAtSunrise(date, coords);
    const inst = getInstantPanchang(
      probe,
      { latitude: coords.lat, longitude: coords.lon },
      { ayanamsa, computeEndTimes: false },
    );
    if (inst) {
      tithiIdx = inst.angas.tithi.index;
      paksha = normalizePaksha(inst.angas.tithi.paksha);
      // Pournami = last tithi of shukla paksha (number 15).
      // Amavasya = last tithi of krishna paksha (number 15).
      pournami = paksha === 'shukla' && inst.angas.tithi.number === 15;
      amavasya = paksha === 'krishna' && inst.angas.tithi.number === 15;
      nakshatra = inst.angas.nakshatra.name ?? '';
      yoga = inst.angas.yoga.name ?? '';
    }
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[calendar]', e.code, e.message);
    }
    // Fall through with defaults.
  }

  const result: ProbeResult = { tithiIdx, paksha, pournami, amavasya, nakshatra, yoga };
  lruSet(PROBE_CACHE, key, result, PROBE_CACHE_MAX);
  return result;
}

function buildDay(
  date: Date,
  coords: { lat: number; lon: number },
  ayanamsa: AyanamsaType,
  selectedDeities: string[],
  eclipseMap: Map<string, 'solar' | 'lunar'>,
  region: FestivalRegion,
  masaSystem: 'purnimanta' | 'amanta',
): CalendarDay {
  const { tithiIdx, paksha, pournami, amavasya, nakshatra, yoga } =
    probeDay(date, coords, ayanamsa);

  // Markers — indexed festival-table lookup via `festivalRow` (≈O(1) after the
  // day's year is ingested, which the first cell of the grid pays for).
  // The table is generated at `region: 'all'` + purnimanta, so the user's
  // Region and month system have to be applied here; without the region a
  // Tamil Nadu user's grid carries Lohri, Gudi Padwa, Bonalu, Bihu, Gangaur,
  // the three Teejs and ~20 more, and without the corrections an Amanta user
  // sees the North Indian Shravan Mondays and a Kerala user loses the Masik
  // Karthigai that falls on Karthigai Deepam. Called even when the table has no
  // row: a correction can add a day it does not carry.
  const row = festivalRow(date);
  const rawList = collapseEkadashi([
    ...festivalsForDay(ymdKey(date), row?.festivals ?? [], region, masaSystem),
  ]);
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
  // Eclipses are sourced live (not in the festival table) — see eclipsesForCells.
  const eclipse: 'solar' | 'lunar' | null = eclipseMap.get(ymdKey(date)) ?? null;
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
    opts.region,
  );
  const hit = lruHit(MONTH_CACHE, key);
  if (hit) {
    pmark('calendar:getCalendarMonth:hit', `${year}-${month + 1}`);
    return hit;
  }
  pmark('calendar:getCalendarMonth:miss', `${year}-${month + 1}`);
  const endBuild = ptime('calendar:getCalendarMonth:build');
  const cellDates = buildCells(year, month);
  const eclipseMap = eclipsesForCells(cellDates, coords);
  const cells = cellDates.map(d =>
    buildDay(d, coords, opts.ayanamsa, opts.selectedDeities, eclipseMap, opts.region, opts.masaSystem),
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
      // `chandramasa.name` follows whichever `masaSystem` was requested, and
      // this call passes none — so it is always the purnimanta name. Read the
      // two absolute fields, which are system-independent.
      hinduMasa = opts.masaSystem === 'amanta'
        ? inst.calendar.chandramasa.amantaName
        : inst.calendar.chandramasa.purnimantaName;
      vikramSamvat = inst.calendar.samvat.vikramSamvat;
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
    opts.region,
  );
  return MONTH_CACHE.get(key) ?? null;
}
