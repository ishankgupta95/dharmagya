import {
  computeRashiChart,
  computeNavamsa,
  computeAshtakoot,
  computeAshtottariDasha,
  computeAspects,
  computeCharaDasha,
  computeDivisionalChart,
  computeKaalSarp,
  computeMangalDosha,
  computePitruDosha,
  computeSadeSati,
  computeShadbala,
  computeDignity,
  computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar,
  computeYoginiDasha,
  PanchangError,
  type AspectMap,
  type AyanamsaType,
  type BirthChart,
  type CharaDashaResult,
  type Divisional,
  type DivisionalChart,
  type AshtakootResult,
  type KaalSarpDoshaInfo,
  type MangalDoshaInfo,
  type PitruDoshaInfo,
  type SadeSatiInfo,
  type ShadbalaResult,
  type Dignity,
  type GrahaName,
  type HouseSystem,
  type Language,
  type AntarDasha,
  type PratyantarDasha,
  type VimshottariDashaResult,
  type YoginiDashaResult,
  type NatalMoon,
} from 'panchang-ts';
import { wallclockInZoneToUtc } from '@/utils/time';

/** All inputs the library needs to compute any natal chart. */
export interface BirthInputs {
  /** UTC date of birth — already adjusted for the user's local time. */
  date: Date;
  location: { lat: number; lon: number };
  ayanamsa: AyanamsaType;
  language: Language;
  houseSystem: HouseSystem;
}

export interface KundliBundle {
  d1: BirthChart;
  d9: DivisionalChart;
  mangal: MangalDoshaInfo;
  kaalSarp: KaalSarpDoshaInfo;
  pitru: PitruDoshaInfo;
  /** Per-graha dignity in the D1 chart (Sun..Saturn + Rahu/Ketu). */
  dignity: { graha: GrahaName; dignity: Dignity }[];
  /** Houses (1..12) aspected by each graha; uses BPHS 7-only for nodes. */
  aspects: AspectMap;
}

const GRAHAS: GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

// ── Caching ──────────────────────────────────────────────────────────────────
// Each compute is ~5–20ms — small but meaningful when re-rendering on theme
// flips or screen-mount restagers. Memo by a stable input key.

const KUNDLI_CACHE = new Map<string, KundliBundle>();
const KUNDLI_CACHE_MAX = 8;
const DASHA_CACHE = new Map<string, VimshottariDashaResult>();
const DASHA_CACHE_MAX = 8;
const SADESATI_CACHE = new Map<string, SadeSatiInfo>();
const SADESATI_CACHE_MAX = 8;
const DIV_CHART_CACHE = new Map<string, DivisionalChart>();
const DIV_CHART_CACHE_MAX = 16;
const SHADBALA_CACHE = new Map<string, ShadbalaResult>();
const SHADBALA_CACHE_MAX = 8;
const ASHTOTTARI_CACHE = new Map<string, VimshottariDashaResult>();
const YOGINI_CACHE = new Map<string, YoginiDashaResult>();
const CHARA_CACHE = new Map<string, CharaDashaResult>();
const ALT_DASHA_CACHE_MAX = 8;

function lru<K, V>(map: Map<K, V>, key: K, value: V, max: number): V {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > max) {
    const first = map.keys().next().value as K;
    map.delete(first);
  }
  return value;
}

function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  const v = map.get(key);
  if (v === undefined) return undefined;
  map.delete(key);
  map.set(key, v);
  return v;
}

function inputKey(inp: BirthInputs): string {
  return [
    inp.date.getTime(),
    inp.location.lat.toFixed(4),
    inp.location.lon.toFixed(4),
    inp.ayanamsa,
    inp.language,
    inp.houseSystem,
  ].join('|');
}

// ── Public API ───────────────────────────────────────────────────────────────

/** D1 + D9 + Mangal Dosha + per-planet dignity. */
export function computeKundli(inp: BirthInputs): KundliBundle | null {
  const key = inputKey(inp);
  const hit = lruGet(KUNDLI_CACHE, key);
  if (hit) return hit;

  try {
    const d1 = computeRashiChart(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    const d9 = computeNavamsa(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language },
    );
    const mangal = computeMangalDosha(d1);
    const kaalSarp = computeKaalSarp(d1);
    const pitru = computePitruDosha(d1);
    const aspects = computeAspects(d1);
    // computeDignity is a pure lookup; safe to call inline per planet.
    const dignity = GRAHAS.map((graha) => {
      const planet = d1.planets.find((p) => p.planet === graha)!;
      return { graha, dignity: computeDignity(graha, planet.rashi.index) };
    });

    const bundle: KundliBundle = { d1, d9, mangal, kaalSarp, pitru, dignity, aspects };
    return lru(KUNDLI_CACHE, key, bundle, KUNDLI_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli]', e.code, e.message);
    } else {
      console.warn('[kundli] compute failed', e);
    }
    return null;
  }
}

/**
 * Vimshottari dasha + the active mahadasha's antardasha + pratyantar drilldown.
 * Returned as a single packed object so callers can render the timeline in
 * one render pass.
 */
export interface DashaTimeline {
  full: VimshottariDashaResult;
  /** The currently-active antardasha within the active mahadasha, or null
   *  when birth date+time is in the past beyond the 120-year cycle. */
  currentAntardasha: AntarDasha | null;
  /** The pratyantar list inside the active antardasha (9 entries) — empty
   *  when there is no current antardasha. */
  currentPratyantars: PratyantarDasha[];
}

export function computeDashaTimeline(
  birthDate: Date,
  ayanamsa: AyanamsaType,
): DashaTimeline | null {
  const key = `${birthDate.getTime()}|${ayanamsa}`;
  const cached = lruGet(DASHA_CACHE, key);
  const full = cached ?? (() => {
    try {
      return computeVimshottariDashaFromBirth(birthDate, ayanamsa);
    } catch (e) {
      console.warn('[kundli] dasha compute failed', e);
      return null;
    }
  })();
  if (!full) return null;
  if (!cached) lru(DASHA_CACHE, key, full, DASHA_CACHE_MAX);

  const now = Date.now();
  const currentMaha = full.mahaDashas[full.currentIndex];
  const currentAntardasha =
    currentMaha?.antarDashas.find(
      (ad) => ad.startDate.getTime() <= now && ad.endDate.getTime() > now,
    ) ?? null;
  const currentPratyantars = currentAntardasha
    ? computeVimshottariPratyantar(currentAntardasha)
    : [];

  return { full, currentAntardasha, currentPratyantars };
}

/** Saturn's 7.5-year transit relative to a natal moon rashi. */
export function computeSadeSatiCached(
  natalMoonRashi: number,
  asOfDate: Date,
  ayanamsa: AyanamsaType,
): SadeSatiInfo | null {
  // Round asOf to the day — Saturn moves slowly enough that hour-level changes
  // never alter the Sade Sati phase, and a stable key keeps the cache hot
  // across multiple component remounts in the same session.
  const day = Math.floor(asOfDate.getTime() / 86_400_000);
  const key = `${natalMoonRashi}|${day}|${ayanamsa}`;
  const hit = lruGet(SADESATI_CACHE, key);
  if (hit) return hit;
  try {
    const info = computeSadeSati(natalMoonRashi, asOfDate, ayanamsa);
    return lru(SADESATI_CACHE, key, info, SADESATI_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] sade-sati compute failed', e);
    return null;
  }
}

/** Ashtakoot 36-point matching. Pure lookup tables — no caching needed. */
export function matchAshtakoot(boy: NatalMoon, girl: NatalMoon): AshtakootResult | null {
  try {
    return computeAshtakoot(boy, girl);
  } catch (e) {
    console.warn('[kundli] matching failed', e);
    return null;
  }
}

// ── Divisional charts ────────────────────────────────────────────────────────
// D1/D9 ride along in the main bundle; the rest are computed lazily because
// most users never look at D2/D3/D7/D10/D12/D30, and BPHS varga math is non-
// trivial to redo on every chart re-render.

export const DIVISIONAL_CHARTS_BEYOND_D9: Divisional[] = [
  'D2', 'D3', 'D7', 'D10', 'D12', 'D30',
];

export function computeDivisional(
  inp: BirthInputs,
  divisional: Divisional,
): DivisionalChart | null {
  const key = `${inputKey(inp)}|${divisional}`;
  const hit = lruGet(DIV_CHART_CACHE, key);
  if (hit) return hit;
  try {
    const chart = computeDivisionalChart(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      divisional,
      { ayanamsa: inp.ayanamsa, language: inp.language },
    );
    return lru(DIV_CHART_CACHE, key, chart, DIV_CHART_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli] divisional', divisional, e.code, e.message);
    } else {
      console.warn('[kundli] divisional compute failed', divisional, e);
    }
    return null;
  }
}

// ── Shadbala (six-fold strength) ─────────────────────────────────────────────

export function computeShadbalaCached(inp: BirthInputs): ShadbalaResult | null {
  const key = inputKey(inp);
  const hit = lruGet(SHADBALA_CACHE, key);
  if (hit) return hit;
  try {
    const bala = computeShadbala(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(SHADBALA_CACHE, key, bala, SHADBALA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] shadbala compute failed', e);
    return null;
  }
}

// ── Alternative dasha systems ────────────────────────────────────────────────
// Vimshottari is the headline; Ashtottari, Yogini, and Chara are alternative
// classical timings that the library now exposes. All three benefit from the
// caching because each is a 36-120-year forward walk per render.

export type DashaSystem = 'vimshottari' | 'ashtottari' | 'yogini' | 'chara';

export function computeAshtottariCached(
  birthDate: Date,
  ayanamsa: AyanamsaType,
  moonSiderealLon: number,
): VimshottariDashaResult | null {
  const key = `${birthDate.getTime()}|${ayanamsa}|${moonSiderealLon.toFixed(4)}`;
  const hit = lruGet(ASHTOTTARI_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeAshtottariDasha(birthDate, moonSiderealLon);
    return lru(ASHTOTTARI_CACHE, key, result, ALT_DASHA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] ashtottari compute failed', e);
    return null;
  }
}

export function computeYoginiCached(
  birthDate: Date,
  ayanamsa: AyanamsaType,
  moonSiderealLon: number,
): YoginiDashaResult | null {
  const key = `${birthDate.getTime()}|${ayanamsa}|${moonSiderealLon.toFixed(4)}`;
  const hit = lruGet(YOGINI_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeYoginiDasha(birthDate, moonSiderealLon);
    return lru(YOGINI_CACHE, key, result, ALT_DASHA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] yogini compute failed', e);
    return null;
  }
}

export function computeCharaCached(inp: BirthInputs): CharaDashaResult | null {
  const key = inputKey(inp);
  const hit = lruGet(CHARA_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeCharaDasha(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      inp.ayanamsa,
    );
    return lru(CHARA_CACHE, key, result, ALT_DASHA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] chara compute failed', e);
    return null;
  }
}

// ── Helpers callers will need ────────────────────────────────────────────────

/** Given a `BirthChart` (D1) extract the natal Moon's `(rashi, nakshatra)`
 *  for use as input to `matchAshtakoot` / `computeSadeSati`. */
export function natalMoonFromChart(chart: BirthChart): NatalMoon {
  const moon = chart.planets.find((p) => p.planet === 'Moon');
  if (!moon) throw new Error('chart.planets missing Moon');
  // The library's NakshatraInfo on a planet is computed but not surfaced on
  // PlanetPlacement. Derive nakshatra from longitude (27 nakshatras / 360°).
  const nakshatra = Math.floor(moon.longitude / (360 / 27));
  return { rashi: moon.rashi.index, nakshatra: ((nakshatra % 27) + 27) % 27 };
}

/** Sidereal moon longitude from the D1 chart — Ashtottari / Yogini both need
 *  this and `BirthChart.planets[Moon].longitude` is already sidereal. */
export function moonSiderealLonFromChart(chart: BirthChart): number {
  const moon = chart.planets.find((p) => p.planet === 'Moon');
  if (!moon) throw new Error('chart.planets missing Moon');
  return moon.longitude;
}

/** Build a `BirthInputs` payload from the user's saved birth fields in
 *  `useStore` + the relevant ayanamsa/language/houseSystem prefs. Returns
 *  null if any required input is missing.
 *
 *  The `birthPlace.timezone` (IANA, e.g. `Asia/Kolkata`) is used to convert
 *  the wallclock birth time into the correct UTC instant — without it the
 *  computation would silently use the *device's* tz, producing different
 *  results on different devices. */
export function buildBirthInputs(args: {
  birthDateIso: string | null;
  birthTimeHHmm: string | null;
  birthPlace: { lat: number; lon: number; name: string; timezone: string } | null;
  ayanamsa: AyanamsaType;
  language: Language;
  houseSystem: HouseSystem;
}): BirthInputs | null {
  if (!args.birthDateIso || !args.birthPlace) return null;
  const time = args.birthTimeHHmm ?? '12:00';
  let date: Date;
  try {
    date = wallclockInZoneToUtc(args.birthDateIso, time, args.birthPlace.timezone);
  } catch {
    return null;
  }
  return {
    date,
    location: { lat: args.birthPlace.lat, lon: args.birthPlace.lon },
    ayanamsa: args.ayanamsa,
    language: args.language,
    houseSystem: args.houseSystem,
  };
}
