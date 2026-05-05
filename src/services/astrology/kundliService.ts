import {
  computeRashiChart,
  computeNavamsa,
  computeAshtakoot,
  computeMangalDosha,
  computeSadeSati,
  computeDignity,
  computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar,
  PanchangError,
  type AyanamsaType,
  type BirthChart,
  type DivisionalChart,
  type AshtakootResult,
  type MangalDoshaInfo,
  type SadeSatiInfo,
  type Dignity,
  type GrahaName,
  type HouseSystem,
  type Language,
  type AntarDasha,
  type PratyantarDasha,
  type VimshottariDashaResult,
  type NatalMoon,
} from 'panchang-ts';

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
  /** Per-graha dignity in the D1 chart (Sun..Saturn + Rahu/Ketu). */
  dignity: { graha: GrahaName; dignity: Dignity }[];
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
    // computeDignity is a pure lookup; safe to call inline per planet.
    const dignity = GRAHAS.map((graha) => {
      const planet = d1.planets.find((p) => p.planet === graha)!;
      return { graha, dignity: computeDignity(graha, planet.rashi.index) };
    });

    const bundle: KundliBundle = { d1, d9, mangal, dignity };
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

/** Build a `BirthInputs` payload from the user's saved birth fields in
 *  `useStore` + the relevant ayanamsa/language/houseSystem prefs. Returns
 *  null if any required input is missing. */
export function buildBirthInputs(args: {
  birthDateIso: string | null;
  birthTimeHHmm: string | null;
  birthPlace: { lat: number; lon: number; name: string } | null;
  ayanamsa: AyanamsaType;
  language: Language;
  houseSystem: HouseSystem;
}): BirthInputs | null {
  if (!args.birthDateIso || !args.birthPlace) return null;
  const time = args.birthTimeHHmm ?? '12:00';
  const date = new Date(`${args.birthDateIso}T${time}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date,
    location: { lat: args.birthPlace.lat, lon: args.birthPlace.lon },
    ayanamsa: args.ayanamsa,
    language: args.language,
    houseSystem: args.houseSystem,
  };
}
