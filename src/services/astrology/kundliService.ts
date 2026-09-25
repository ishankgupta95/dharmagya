import {
  computeArgala,
  computeArudhas,
  computeBhavaLagna,
  computeGhatiLagna,
  computeHoraLagna,
  computeKpCuspalSubLords,
  computeKpSignificators,
  computeNarayanDasha,
  computePrashnaChart,
  computeRashiChart,
  computeNavamsa,
  computeAshtakavarga,
  computeAshtakoot,
  computeAshtottariDasha,
  computeAspects,
  computeBhavaBala,
  computeCharaDasha,
  computeDivisionalChart,
  computeJaiminiKarakas,
  computeKaalSarp,
  computeMangalDosha,
  computePathuPorutham,
  computePitruDosha,
  computeSadeSati,
  computeShadbala,
  computeSripatiLagna,
  computeDignity,
  computeTithiPravesha,
  computeUpagrahas,
  computeVarshaphala,
  computeVimshottariDashaFromBirth,
  computeVimshottariPratyantarIn,
  computeYogas,
  computeYoginiDasha,
  PanchangError,
  type ArgalaPerBhava,
  type Arudha,
  type AshtakavargaResult,
  type AspectMap,
  type AyanamsaType,
  type BhavaBalaResult,
  type BirthChart,
  type CharaDashaResult,
  type Divisional,
  type DivisionalChart,
  type AshtakootResult,
  type GeoLocation,
  type Jaimini8Karakas,
  type JaiminiKarakas,
  type KaalSarpDoshaInfo,
  type KpCuspalSubLords,
  type KpSignificators,
  type LagnaInfo,
  type MangalDoshaInfo,
  type NarayanDashaResult,
  type PathuPoruthamResult,
  type PitruDoshaInfo,
  type SadeSatiInfo,
  type ShadbalaResult,
  type SripatiLagnaInfo,
  type Dignity,
  type GrahaName,
  type HouseSystem,
  type Language,
  type AntarDasha,
  type PratyantarDasha,
  type TithiPraveshaChart,
  type Upagrahas,
  type VarshaphalaChart,
  type VimshottariDashaResult,
  type Yoga,
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
  /** Named classical yogas matched in the chart (~25-entry catalog). */
  yogas: Yoga[];
  /** Atmakaraka..Darakaraka — Parashara 7-Karaka variant from the D1. */
  karakas: JaiminiKarakas;
  /** Atmakaraka..Darakaraka — Jaimini 8-Karaka variant (adds Pitrukaraka).
   *  Pre-computed so the KarakasCard toggle is purely cosmetic. */
  karakas8: Jaimini8Karakas;
  /** Bhinnashtaka per receiver + Sarvashtaka sum (BPHS Ch. 66). */
  ashtakavarga: AshtakavargaResult;
  /** 12 Arudha padas (AL, A2..A12) — pure D1 walk. */
  arudhas: Arudha[];
  /** Per-bhava Argala + Virodhargala (BPHS Ch. 51), with Trikonargala (5/9
   *  trine variant) populated under `entry.trikona` per panchang-ts 4.1
   *  opt-in. */
  argala: ArgalaPerBhava[];
  /** KP 4-fold significators (per-planet + per-house) — pure D1 lookup. */
  kpSignificators: KpSignificators;
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
const BHAVA_BALA_CACHE = new Map<string, BhavaBalaResult>();
const BHAVA_BALA_CACHE_MAX = 8;
const VARSHAPHALA_CACHE = new Map<string, VarshaphalaChart>();
const VARSHAPHALA_CACHE_MAX = 4;
const TITHI_PRAVESHA_CACHE = new Map<string, TithiPraveshaChart>();
const TITHI_PRAVESHA_CACHE_MAX = 4;
const ASHTOTTARI_CACHE = new Map<string, VimshottariDashaResult>();
const YOGINI_CACHE = new Map<string, YoginiDashaResult>();
const CHARA_CACHE = new Map<string, CharaDashaResult>();
const NARAYAN_CACHE = new Map<string, NarayanDashaResult>();
const ALT_DASHA_CACHE_MAX = 8;
const UPAGRAHAS_CACHE = new Map<string, Upagrahas>();
const UPAGRAHAS_CACHE_MAX = 8;
const SPECIAL_LAGNAS_CACHE = new Map<string, SpecialLagnas>();
const SPECIAL_LAGNAS_CACHE_MAX = 8;
const KP_CUSPAL_CACHE = new Map<string, KpCuspalSubLords>();
const KP_CUSPAL_CACHE_MAX = 8;
const PRASHNA_CACHE = new Map<string, BirthChart>();
const PRASHNA_CACHE_MAX = 4;

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
    // Yogas evaluates a fixed ~25-entry catalog; Vargottama needs the D9 so
    // pass it. Karakas is a single 7-element sort. Ashtakavarga walks the
    // canonical BENEFIC_OFFSETS table (BPHS Ch. 66). All three are cheap
    // enough to ride along in the bundle.
    const yogas = computeYogas(d1, { navamsa: d9 });
    const karakas = computeJaiminiKarakas(d1);
    const karakas8 = computeJaiminiKarakas(d1, { variant: '8-jaimini' });
    const ashtakavarga = computeAshtakavarga(d1);
    // Arudhas (12 padas) and Argala (per-bhava intervention/counter) are pure
    // D1 walks — ride along too. KP significators is a single 4-rule lookup
    // over the D1 occupants + lords; same cost class. Argala's Trikonargala
    // 5/9-trine variant is opt-in per the 4.1 release; we always request it
    // because the cost is a second pass over `chart.planets` (microseconds)
    // and the AdvancedPointsCard surfaces it.
    const arudhas = computeArudhas(d1, inp.language);
    const argala = computeArgala(d1, { includeTrikonargala: true });
    const kpSignificators = computeKpSignificators(d1);

    const bundle: KundliBundle = {
      d1, d9, mangal, kaalSarp, pitru, dignity, aspects,
      yogas, karakas, karakas8, ashtakavarga,
      arudhas, argala, kpSignificators,
    };
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
  // The `In` form splits the antardasha's FULL span and clips it, so the birth
  // antardasha (clipped at birth) gets the pratyantars that actually ran; for
  // every other antardasha it equals `computeVimshottariPratyantar`.
  const currentPratyantars = currentAntardasha
    ? computeVimshottariPratyantarIn(currentMaha, currentAntardasha)
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

/** Pathu Porutham 10-fold Tamil compatibility — sibling of Ashtakoot. Pure
 *  lookup tables; no caching. Returns the per-koot detail + a `recommended`
 *  flag that combines the 5-of-10 threshold with veto handling. */
export function matchPathuPorutham(boy: NatalMoon, girl: NatalMoon): PathuPoruthamResult | null {
  try {
    return computePathuPorutham(boy, girl);
  } catch (e) {
    console.warn('[kundli] pathu porutham failed', e);
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

// ── Bhava Bala (four-source house strength) ─────────────────────────────────
// Companion to Shadbala — shares the natural-strength + drik-weight tables
// per BPHS Ch. 27. Time-and-location-dependent (not pure-D1) so it lives
// outside `KundliBundle` with its own cache, mirroring `computeShadbalaCached`.

export function computeBhavaBalaCached(inp: BirthInputs): BhavaBalaResult | null {
  const key = inputKey(inp);
  const hit = lruGet(BHAVA_BALA_CACHE, key);
  if (hit) return hit;
  try {
    const bala = computeBhavaBala(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(BHAVA_BALA_CACHE, key, bala, BHAVA_BALA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] bhava bala compute failed', e);
    return null;
  }
}

// ── Varshaphala (Tajik annual return) ───────────────────────────────────────
// `computeVarshaphala` casts at the **solar-return instant** for `yearAge`
// (1-indexed: 1 = first solar return). Output bundles Varsha Lagna, Muntha,
// Year Lord (max-Shadbala among 4 candidates), 27 Sahams, plus full 9-graha
// + bhava package at the return instant. Time-shifted recompute → outside
// `KundliBundle`, with its own LRU keyed on `inputKey | yearAge`.

export function computeVarshaphalaCached(
  inp: BirthInputs,
  yearAge: number,
): VarshaphalaChart | null {
  const key = `${inputKey(inp)}|v${yearAge}`;
  const hit = lruGet(VARSHAPHALA_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeVarshaphala(
      inp.date,
      yearAge,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(VARSHAPHALA_CACHE, key, result, VARSHAPHALA_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli] varshaphala', e.code, e.message);
    } else {
      console.warn('[kundli] varshaphala compute failed', e);
    }
    return null;
  }
}

// ── Tithi Pravesha (annual soli-lunar return) ───────────────────────────────
// Companion to Varshaphala — same `yearAge` parameter, but the chart is cast
// when (a) sidereal Sun matches its natal sign AND (b) the Sun-Moon
// separation matches natal (PVR Narasimha Rao redefinition). Output is a
// classic D1-shaped result (lagna + 9 grahas + bhava).

export function computeTithiPraveshaCached(
  inp: BirthInputs,
  yearAge: number,
): TithiPraveshaChart | null {
  const key = `${inputKey(inp)}|tp${yearAge}`;
  const hit = lruGet(TITHI_PRAVESHA_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeTithiPravesha(
      inp.date,
      yearAge,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(TITHI_PRAVESHA_CACHE, key, result, TITHI_PRAVESHA_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli] tithi-pravesha', e.code, e.message);
    } else {
      console.warn('[kundli] tithi-pravesha compute failed', e);
    }
    return null;
  }
}

// ── Alternative dasha systems ────────────────────────────────────────────────
// Vimshottari is the headline; Ashtottari, Yogini, and Chara are alternative
// classical timings that the library now exposes. All three benefit from the
// caching because each is a 36-120-year forward walk per render.

export type DashaSystem = 'vimshottari' | 'ashtottari' | 'yogini' | 'chara' | 'narayan';

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

// Narayan Dasha — Chara skeleton with the vishama-/sama-pada parity-direction
// rule. Same `(date, location, ayanamsa)` shape as Chara, returned as a
// `NarayanDashaResult` with `direction` flag.

export function computeNarayanCached(inp: BirthInputs): NarayanDashaResult | null {
  const key = inputKey(inp);
  const hit = lruGet(NARAYAN_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeNarayanDasha(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      inp.ayanamsa,
    );
    return lru(NARAYAN_CACHE, key, result, ALT_DASHA_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] narayan compute failed', e);
    return null;
  }
}

// ── Sensitive points (P12.4) ────────────────────────────────────────────────
// Upagrahas + 4 special lagnas are time-and-location-dependent — outside
// `KundliBundle`, with their own caches mirroring `computeShadbalaCached`.
// Arudhas / Argala / KP Significators are pure-D1 and ride along in the
// bundle (see `computeKundli` above).

export function computeUpagrahasCached(inp: BirthInputs): Upagrahas | null {
  const key = inputKey(inp);
  const hit = lruGet(UPAGRAHAS_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeUpagrahas(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(UPAGRAHAS_CACHE, key, result, UPAGRAHAS_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli] upagrahas', e.code, e.message);
    } else {
      console.warn('[kundli] upagrahas compute failed', e);
    }
    return null;
  }
}

/** All four classical "special lagnas" packed in one shot — Hora / Ghati /
 *  Bhava / Sripati. Each one is a single-formula lookup but they share inputs,
 *  so a combined cache lets the UI render them as a 4-row table without four
 *  separate LRU keys. Sripati requests the cusp extension so the
 *  AdvancedPointsCard can render the 12 bhava-madhya longitudes alongside the
 *  cusp-1 lagna; default callers ignore the extra `.cusps` field. */
export interface SpecialLagnas {
  hora: LagnaInfo;
  ghati: LagnaInfo;
  bhava: LagnaInfo;
  sripati: SripatiLagnaInfo;
}

export function computeSpecialLagnasCached(inp: BirthInputs): SpecialLagnas | null {
  const key = inputKey(inp);
  const hit = lruGet(SPECIAL_LAGNAS_CACHE, key);
  if (hit) return hit;
  try {
    const loc = { latitude: inp.location.lat, longitude: inp.location.lon };
    const result: SpecialLagnas = {
      hora: computeHoraLagna(inp.date, loc, inp.ayanamsa, inp.language),
      ghati: computeGhatiLagna(inp.date, loc, inp.ayanamsa, inp.language),
      bhava: computeBhavaLagna(inp.date, loc, inp.ayanamsa, inp.language),
      sripati: computeSripatiLagna(inp.date, loc, inp.ayanamsa, inp.language, { includeCusps: true }),
    };
    return lru(SPECIAL_LAGNAS_CACHE, key, result, SPECIAL_LAGNAS_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] special lagnas compute failed', e);
    return null;
  }
}

// ── KP cuspal sub-lords (P12.5) ─────────────────────────────────────────────
// Time-and-location-dependent (calls `computeBhava` internally). The library
// forces Placidus-KP cusps regardless of the `houseSystem` we pass — we still
// pass `inp.houseSystem` through so the cache key remains identical to the
// other entries; the override is harmless.

export function computeKpCuspalSubLordsCached(inp: BirthInputs): KpCuspalSubLords | null {
  const key = inputKey(inp);
  const hit = lruGet(KP_CUSPAL_CACHE, key);
  if (hit) return hit;
  try {
    const result = computeKpCuspalSubLords(
      inp.date,
      { latitude: inp.location.lat, longitude: inp.location.lon },
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(KP_CUSPAL_CACHE, key, result, KP_CUSPAL_CACHE_MAX);
  } catch (e) {
    console.warn('[kundli] kp cuspal compute failed', e);
    return null;
  }
}

// ── Prashna (P12.5) ─────────────────────────────────────────────────────────
// Cast at a *query* moment from the *querent's* location — totally separate
// from the natal chart, so the cache key is built from the prashna inputs
// directly rather than `BirthInputs`.

export interface PrashnaInputs {
  /** Moment the question was asked (UTC absolute). */
  timestamp: Date;
  /** Querent's current location — defaults to `userLocation` in the screen. */
  location: { lat: number; lon: number };
  ayanamsa: AyanamsaType;
  language: Language;
  houseSystem: HouseSystem;
}

function prashnaKey(inp: PrashnaInputs): string {
  return [
    inp.timestamp.getTime(),
    inp.location.lat.toFixed(4),
    inp.location.lon.toFixed(4),
    inp.ayanamsa,
    inp.language,
    inp.houseSystem,
  ].join('|');
}

export function computePrashnaChartCached(inp: PrashnaInputs): BirthChart | null {
  const key = prashnaKey(inp);
  const hit = lruGet(PRASHNA_CACHE, key);
  if (hit) return hit;
  try {
    const result = computePrashnaChart(
      inp.timestamp,
      { latitude: inp.location.lat, longitude: inp.location.lon } satisfies GeoLocation,
      { ayanamsa: inp.ayanamsa, language: inp.language, houseSystem: inp.houseSystem },
    );
    return lru(PRASHNA_CACHE, key, result, PRASHNA_CACHE_MAX);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[kundli] prashna', e.code, e.message);
    } else {
      console.warn('[kundli] prashna compute failed', e);
    }
    return null;
  }
}

// ── Helpers callers will need ────────────────────────────────────────────────

/** Given a `BirthChart` (D1) extract the natal Moon's `(rashi, nakshatra)`
 *  for use as input to `matchAshtakoot` / `computeSadeSati`. Pass the
 *  divisional D9 (Navamsa) too and the result also carries `lagnaRashi`
 *  (chart ascendant) and `navamsaRashi` (Moon's rashi in D9). When both
 *  natives in `computeAshtakoot` supply these, the library opts into three
 *  extra Bhakoot cancellations (same lagna-lord / same 7th-house lord /
 *  same Navamsa-lord) per panchang-ts 4.1. */
export function natalMoonFromChart(chart: BirthChart, navamsa?: DivisionalChart): NatalMoon {
  const moon = chart.planets.find((p) => p.planet === 'Moon');
  if (!moon) throw new Error('chart.planets missing Moon');
  // The library's NakshatraInfo on a planet is computed but not surfaced on
  // PlanetPlacement. Derive nakshatra from longitude (27 nakshatras / 360°).
  const nakshatra = Math.floor(moon.longitude / (360 / 27));
  const result: NatalMoon = {
    rashi: moon.rashi.index,
    nakshatra: ((nakshatra % 27) + 27) % 27,
    lagnaRashi: chart.lagna.rashi.index,
  };
  if (navamsa) {
    const moonD9 = navamsa.planets.find((p) => p.planet === 'Moon');
    if (moonD9) result.navamsaRashi = moonD9.rashi.index;
  }
  return result;
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
