import * as Location from 'expo-location';
import {
  getDailyPanchang,
  getInstantPanchang,
  computePlanetaryPositions,
  getSiderealMoonLongitude,
  getUpcomingSolarEclipse,
  getUpcomingLunarEclipse,
  GRAHA_ABBR,
  PanchangError,
  type AyanamsaType,
  type DailyPanchangResult,
  type DailyTithiInfo,
  type DailyNakshatraInfo,
  type DailyYogaInfo,
  type DailyKaranaInfo,
  type FestivalRegion,
  type GrahaName,
  type Language,
} from 'panchang-ts';

import type {
  IPanchangDay,
  IPanchangElement,
  IQualitySlot,
  IHoraSlot,
  IGrahaPosition,
  IFestival,
  IEclipse,
  IEclipseSummary,
  IInstantPanchang,
  IBhadra,
  IChandraBalam,
  FestivalType,
} from '@/types';

export const FALLBACK_COORDS = { lat: 25.3176, lon: 83.0103 }; // Varanasi (Kashi)

// Re-exported for diagnostic UI; everything else uses the canonical `IGrahaPosition.planetEn`.
export { GRAHA_ABBR };
export type { GrahaName };

/**
 * Native's janma (birth) nakshatra index (0=Ashwini … 26=Revati) derived
 * from the sidereal Moon longitude at the birth moment. Geocentric — does
 * not depend on birth location.
 */
export function computeJanmaNakshatraIndex(birth: Date): number {
  const lon = getSiderealMoonLongitude(birth, 'lahiri');
  const idx = Math.floor(lon / (360 / 27));
  return ((idx % 27) + 27) % 27;
}

/**
 * Native's janma (birth) rashi index (0=Mesha … 11=Meena) — companion to
 * janmaNakshatra, used for Chandra Balam.
 */
export function computeJanmaRashiIndex(birth: Date): number {
  const lon = getSiderealMoonLongitude(birth, 'lahiri');
  const idx = Math.floor(lon / 30);
  return ((idx % 12) + 12) % 12;
}

// Name tables for computePlanetaryPositions (which uses callbacks, not a language option)
const RASHI_NAMES: Record<Language, string[]> = {
  en: [
    'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
    'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
  ],
  hi: [
    'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
    'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
  ],
};

const NAKSHATRA_NAMES: Record<Language, string[]> = {
  en: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ],
  hi: [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
    'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी',
    'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
    'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
    'पूर्वा भाद्रपद', 'उत्तरा भाद्रपद', 'रेवती',
  ],
};

const GRAHA_NAMES: Record<Language, Record<GrahaName, string>> = {
  en: { Sun: 'Sun', Moon: 'Moon', Mars: 'Mars', Mercury: 'Mercury', Jupiter: 'Jupiter', Venus: 'Venus', Saturn: 'Saturn', Rahu: 'Rahu', Ketu: 'Ketu' },
  hi: { Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध', Jupiter: 'बृहस्पति', Venus: 'शुक्र', Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु' },
};

// Note on intentionally-unused panchang-ts surface area:
// • Classical aliases `dinamanaMinutes` / `ratrimanaMinutes` are not surfaced
//   because they're identical to `dayDurationMinutes` / `nightDurationMinutes`,
//   which we already display.
// • Standalone helpers — `computeAbhijitMuhurta`, `getMoonrise`, `getEclipseDuringDay`,
//   `computeVimshottariDasha` (raw), etc. — are deliberately not used directly:
//   all daily fields flow through `getDailyPanchang` so the LRU cache below
//   stays the source of truth, and `computeVimshottariDashaFromBirth` is
//   preferred over `computeVimshottariDasha` because we always have a birth
//   moment.

// Dates from panchang-ts are offset-adjusted local display dates — read via getUTC*.
function formatTime(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Coerce the lib's locale-specific paksha string into our typed union. */
function normalizePaksha(p: string | undefined | null): 'Shukla' | 'Krishna' | null {
  if (!p) return null;
  const trimmed = p.trim();
  if (trimmed === 'Shukla' || trimmed === 'शुक्ल') return 'Shukla';
  if (trimmed === 'Krishna' || trimmed === 'कृष्ण') return 'Krishna';
  return null;
}

function toTithiElements(items: DailyTithiInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatTime(item.endTime),
    endTimeMs: item.endTime?.getTime(),
    paksha: normalizePaksha(item.paksha),
    tithiNumber: item.number,
    completionPercentage: item.completionPercentage,
    startTime: formatTime(item.startTime),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toNakshatraElements(items: DailyNakshatraInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatTime(item.endTime),
    endTimeMs: item.endTime?.getTime(),
    pada: item.pada,
    completionPercentage: item.completionPercentage,
    startTime: formatTime(item.startTime),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toYogaElements(items: DailyYogaInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatTime(item.endTime),
    endTimeMs: item.endTime?.getTime(),
    completionPercentage: item.completionPercentage,
    startTime: formatTime(item.startTime),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toKaranaElements(items: DailyKaranaInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatTime(item.endTime),
    endTimeMs: item.endTime?.getTime(),
    karanaType: item.type,
    completionPercentage: item.completionPercentage,
    startTime: formatTime(item.startTime),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

interface RawQualitySlot {
  name: string;
  quality: IQualitySlot['quality'];
  qualityName: string;
  start: Date;
  end: Date;
}

function toQualitySlots(slots: readonly RawQualitySlot[]): IQualitySlot[] {
  return slots.map(s => ({
    name: s.name,
    quality: s.quality,
    qualityName: s.qualityName,
    start: formatTime(s.start) ?? '',
    end: formatTime(s.end) ?? '',
  }));
}

function toHoraSlots(
  slots: DailyPanchangResult['hora']['day'],
): IHoraSlot[] {
  return slots.map(s => ({
    planet: s.planet,
    start: formatTime(s.start) ?? '',
    end: formatTime(s.end) ?? '',
  }));
}

function ymdOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapFestivals(list: DailyPanchangResult['festivals']): IFestival[] {
  // Collapse triple-emission Ekadashi: drop the generic 'ekadashi' entry when a
  // smarta_ekadashi or vaishnava_ekadashi is already present for the same day.
  const hasSubtype = list.some(
    f => f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  return list
    .filter(f => !(hasSubtype && f.type === 'ekadashi'))
    .map(f => ({
      name: f.name,
      type: f.type as FestivalType,
      description: f.description,
      deferralDate: f.deferralDate ? ymdOf(f.deferralDate) : undefined,
    }));
}

function mapEclipse(e: DailyPanchangResult['eclipse']): IEclipse | null {
  if (!e) return null;
  return {
    kind: e.kind,
    subtype: e.subtype,
    peak: formatTime(e.peak) ?? '',
    start: formatTime(e.start) ?? '',
    end: formatTime(e.end) ?? '',
    sutakStart: formatTime(e.sutakStart) ?? '',
    sutakEnd: formatTime(e.sutakEnd) ?? '',
    visibleFromLocation: e.visibleFromLocation,
    magnitude: e.magnitude,
    description: e.description,
  };
}

function mapBhadra(b: DailyPanchangResult['bhadra']): IBhadra | null {
  if (!b) return null;
  return {
    start: formatTime(b.start) ?? '',
    end: formatTime(b.end) ?? '',
    location: b.location,
  };
}

function mapChandraBalam(cb: DailyPanchangResult['chandraBalam']): IChandraBalam | null {
  if (!cb) return null;
  return {
    house: cb.house,
    quality: cb.quality,
    englishName: cb.englishName,
    name: cb.name,
  };
}

export function mapToPanchangDay(result: DailyPanchangResult): IPanchangDay {
  return {
    date: result.date,
    tithis: toTithiElements(result.tithis),
    nakshatras: toNakshatraElements(result.nakshatras),
    yogas: toYogaElements(result.yogas),
    karanas: toKaranaElements(result.karanas),
    sunrise: formatTime(result.sunrise) ?? '—',
    sunset: formatTime(result.sunset) ?? '—',
    nextSunrise: formatTime(result.nextSunrise),
    ayanamsa: result.ayanamsa,
    rahuKalamStart: formatTime(result.rahuKalam.start),
    rahuKalamEnd: formatTime(result.rahuKalam.end),
    yamagandaStart: formatTime(result.yamaganda.start),
    yamagandaEnd: formatTime(result.yamaganda.end),
    gulikaKalamStart: formatTime(result.gulikaKalam.start),
    gulikaKalamEnd: formatTime(result.gulikaKalam.end),
    abhijitMuhurtaStart: formatTime(result.abhijitMuhurta.start),
    abhijitMuhurtaEnd: formatTime(result.abhijitMuhurta.end),
    durMuhurta: result.durMuhurta.map(dm => ({
      start: formatTime(dm.start) ?? '',
      end: formatTime(dm.end) ?? '',
    })),
    vara: result.vara.name,
    hinduMonth: result.chandramasa.purnimantaName,
    hinduMonthAmanta: result.chandramasa.name,
    hinduMonthPurnimanta: result.chandramasa.purnimantaName,
    isAdhikaMasa: result.chandramasa.isAdhika,
    masa: result.masa.name,
    vikramSamvat: result.samvat.vikramSamvat,
    shakaSamvat: result.samvat.shakaSamvat,
    chandraRashi: result.chandraRashi.name,
    suryaNakshatra: result.suryaNakshatra.name,
    moonrise: formatTime(result.moonrise),
    moonset: formatTime(result.moonset),
    brahmaMuhurtaStart: formatTime(result.brahmaMuhurta.start),
    brahmaMuhurtaEnd: formatTime(result.brahmaMuhurta.end),
    vijayaMuhurtaStart: formatTime(result.vijayaMuhurta.start),
    vijayaMuhurtaEnd: formatTime(result.vijayaMuhurta.end),
    godhuliMuhurtaStart: formatTime(result.godhuliMuhurta.start),
    godhuliMuhurtaEnd: formatTime(result.godhuliMuhurta.end),
    nishitaMuhurtaStart: formatTime(result.nishitaMuhurta.start),
    nishitaMuhurtaEnd: formatTime(result.nishitaMuhurta.end),
    amritKalaStart: result.amritKala ? formatTime(result.amritKala.start) : undefined,
    amritKalaEnd: result.amritKala ? formatTime(result.amritKala.end) : undefined,
    madhyahnaStart: formatTime(result.madhyahna.start),
    madhyahnaEnd: formatTime(result.madhyahna.end),
    pratahSandhyaStart: formatTime(result.pratahSandhya.start),
    pratahSandhyaEnd: formatTime(result.pratahSandhya.end),
    sayahnaSandhyaStart: formatTime(result.sayahnaSandhya.start),
    sayahnaSandhyaEnd: formatTime(result.sayahnaSandhya.end),
    varjyamStart: result.varjyam ? formatTime(result.varjyam.start) : undefined,
    varjyamEnd: result.varjyam ? formatTime(result.varjyam.end) : undefined,
    gandaMula: result.gandaMula.active
      ? { nakshatraName: result.gandaMula.nakshatraName, severity: result.gandaMula.severity }
      : null,
    anandadiYoga: { name: result.anandadiYoga.name, quality: result.anandadiYoga.quality },
    tarabala: result.tarabala
      ? { name: result.tarabala.name, englishName: result.tarabala.englishName, quality: result.tarabala.quality }
      : null,
    chandraBalam: mapChandraBalam(result.chandraBalam),
    bhadra: mapBhadra(result.bhadra),
    eclipse: mapEclipse(result.eclipse),
    panchaka: result.panchaka,
    panchakaRahita: result.panchakaRahita.map(p => ({
      start: formatTime(p.start) ?? '',
      end: formatTime(p.end) ?? '',
    })),
    dayDurationMinutes: result.dayDurationMinutes,
    nightDurationMinutes: result.nightDurationMinutes,
    choghadiya: {
      day: toQualitySlots(result.choghadiya.day),
      night: toQualitySlots(result.choghadiya.night),
    },
    gowriPanchangam: {
      day: toQualitySlots(result.gowriPanchangam.day),
      night: toQualitySlots(result.gowriPanchangam.night),
    },
    doGhatiMuhurta: {
      day: toQualitySlots(result.doGhatiMuhurta.day),
      night: toQualitySlots(result.doGhatiMuhurta.night),
    },
    hora: {
      day: toHoraSlots(result.hora.day),
      night: toHoraSlots(result.hora.night),
    },
    specialYogas: result.specialYogas.map(y => ({ name: y.name, type: y.type })),
    festivals: mapFestivals(result.festivals),
  };
}

// ── Cache layer ──────────────────────────────────────────────────────────────
// Small in-memory LRUs for the user-facing screens. Direct `getDailyPanchang` /
// `fetchPanchang` calls stay uncached so [muhurat.ts](./muhurat.ts)'s 365-day
// bulk scan doesn't thrash this cache.

interface CachedDay { day: IPanchangDay; full: boolean }
const DAY_CACHE = new Map<string, CachedDay>();
const DAY_CACHE_MAX = 60;
const GRAHA_CACHE = new Map<string, IGrahaPosition[]>();
const GRAHA_CACHE_MAX = 30;

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayCacheKey(
  date: Date,
  lat: number,
  lon: number,
  language: Language,
  region: FestivalRegion,
  janmaNakshatra: number | undefined,
  janmaRashi: number | undefined,
  ayanamsa: AyanamsaType,
): string {
  const j = janmaNakshatra ?? '_';
  const r = janmaRashi ?? '_';
  return `${ymdLocal(date)}|${lat.toFixed(4)}|${lon.toFixed(4)}|${language}|${region}|${j}|${r}|${ayanamsa}`;
}

function lruSet<K, V>(map: Map<K, V>, key: K, value: V, max: number) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > max) {
    const first = map.keys().next().value as K;
    map.delete(first);
  }
}

function lruHit<K, V>(map: Map<K, V>, key: K): V | undefined {
  const v = map.get(key);
  if (v === undefined) return undefined;
  map.delete(key);
  map.set(key, v);
  return v;
}

/**
 * Cached panchang-for-a-day. A full-pass result (`computeEndTimes: true`) also
 * satisfies later fast-pass requests — cache is upgrade-only.
 */
export function getCachedPanchangDay(
  date: Date,
  coords: { lat: number; lon: number },
  opts: {
    computeEndTimes: boolean;
    language: Language;
    region: FestivalRegion;
    janmaNakshatra?: number;
    janmaRashi?: number;
    ayanamsa?: AyanamsaType;
  },
): IPanchangDay | null {
  const ayanamsa = opts.ayanamsa ?? 'lahiri';
  const key = dayCacheKey(date, coords.lat, coords.lon, opts.language, opts.region, opts.janmaNakshatra, opts.janmaRashi, ayanamsa);
  const hit = lruHit(DAY_CACHE, key);
  if (hit && (hit.full || !opts.computeEndTimes)) return hit.day;

  const timezone = -new Date().getTimezoneOffset();
  const raw = getDailyPanchang(
    date,
    { latitude: coords.lat, longitude: coords.lon },
    {
      timezone,
      computeEndTimes: opts.computeEndTimes,
      language: opts.language,
      region: opts.region,
      janmaNakshatra: opts.janmaNakshatra,
      janmaRashi: opts.janmaRashi,
      ayanamsa,
    },
  );
  if (!raw) return null;
  const mapped = mapToPanchangDay(raw);
  lruSet(DAY_CACHE, key, { day: mapped, full: opts.computeEndTimes }, DAY_CACHE_MAX);
  return mapped;
}

export function getCachedGrahaPositions(
  date: Date,
  language: Language = 'en',
  ayanamsa: AyanamsaType = 'lahiri',
): IGrahaPosition[] {
  const key = `${ymdLocal(date)}|${language}|${ayanamsa}`;
  const hit = lruHit(GRAHA_CACHE, key);
  if (hit) return hit;
  const result = fetchGrahaPositions(date, language, ayanamsa);
  lruSet(GRAHA_CACHE, key, result, GRAHA_CACHE_MAX);
  return result;
}

export function fetchGrahaPositions(
  date: Date,
  language: Language = 'en',
  ayanamsa: AyanamsaType = 'lahiri',
): IGrahaPosition[] {
  const grahaNames = GRAHA_NAMES[language];
  const rashiNames = RASHI_NAMES[language];
  const nakshatraNames = NAKSHATRA_NAMES[language];
  const raw = computePlanetaryPositions(
    date,
    ayanamsa,
    (idx) => nakshatraNames[idx],
    (idx) => rashiNames[idx],
  );
  const keys: { key: keyof typeof raw; en: GrahaName }[] = [
    { key: 'sun', en: 'Sun' },
    { key: 'moon', en: 'Moon' },
    { key: 'mars', en: 'Mars' },
    { key: 'mercury', en: 'Mercury' },
    { key: 'jupiter', en: 'Jupiter' },
    { key: 'venus', en: 'Venus' },
    { key: 'saturn', en: 'Saturn' },
    { key: 'rahu', en: 'Rahu' },
    { key: 'ketu', en: 'Ketu' },
  ];
  return keys.map(({ key, en }) => {
    const p = raw[key];
    return {
      planet: grahaNames[en] ?? en,
      planetEn: en,
      rashi: p.rashi.name,
      degreeInRashi: Math.round(p.degreeInRashi * 100) / 100,
      nakshatra: p.nakshatra.name,
      nakshatraPada: p.nakshatra.pada,
      isRetrograde: p.isRetrograde,
    };
  });
}

// Only checks existing permission — never shows a dialog.
// Permission is requested explicitly from the location-permission screen.
async function getCoords(): Promise<{ lat: number; lon: number }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: loc.coords.latitude, lon: loc.coords.longitude };
    }
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
  }
  return FALLBACK_COORDS;
}

export async function fetchPanchang(
  date: Date,
  savedCoords?: { lat: number; lon: number } | null,
  computeEndTimes = true,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  janmaNakshatra?: number,
  janmaRashi?: number,
  ayanamsa: AyanamsaType = 'lahiri',
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    const timezone = -new Date().getTimezoneOffset();
    const result = getDailyPanchang(
      date,
      { latitude: coords.lat, longitude: coords.lon },
      { timezone, computeEndTimes, language, region, janmaNakshatra, janmaRashi, ayanamsa },
    );
    if (!result) return null;
    return mapToPanchangDay(result);
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

export async function fetchPanchangForToday(
  savedCoords?: { lat: number; lon: number } | null,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  ayanamsa: AyanamsaType = 'lahiri',
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    return getCachedPanchangDay(new Date(), coords, { computeEndTimes: true, language, region, ayanamsa });
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

/**
 * Snapshot of tithi/nakshatra/yoga/karana at the queried instant. Lighter than
 * `getCachedPanchangDay` — used to render an "AT THIS MOMENT" line on Today.
 */
export function fetchInstantPanchang(
  now: Date,
  coords: { lat: number; lon: number },
  language: Language = 'en',
  ayanamsa: AyanamsaType = 'lahiri',
): IInstantPanchang | null {
  try {
    const raw = getInstantPanchang(
      now,
      { latitude: coords.lat, longitude: coords.lon },
      { language, ayanamsa, computeEndTimes: false },
    );
    if (!raw) return null;
    return {
      tithi: raw.tithi.name,
      nakshatra: raw.nakshatra.name,
      yoga: raw.yoga.name,
      karana: raw.karana.name,
    };
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

// Eclipses are deterministic and far apart; a tiny memo is plenty.
interface EclipseCacheEntry {
  solar: IEclipseSummary | null;
  lunar: IEclipseSummary | null;
}
const ECLIPSE_CACHE = new Map<string, EclipseCacheEntry>();
const ECLIPSE_CACHE_MAX = 8;

const ECLIPSE_LOOK_AHEAD_DAYS = 365;

function eclipseDateOf(d: Date): string {
  // Eclipses come from panchang-ts as UTC Date objects; convert to local YMD.
  const local = new Date(d);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function summarizeEclipse(e: ReturnType<typeof getUpcomingSolarEclipse>): IEclipseSummary | null {
  if (!e) return null;
  return {
    kind: e.kind,
    subtype: e.subtype,
    date: eclipseDateOf(e.peak),
    peak: formatTime(e.peak) ?? '',
    visibleFromLocation: e.visibleFromLocation,
    description: e.description,
  };
}

export function fetchUpcomingEclipses(
  fromDate: Date,
  coords: { lat: number; lon: number },
): EclipseCacheEntry {
  const key = `${eclipseDateOf(fromDate)}|${coords.lat.toFixed(2)}|${coords.lon.toFixed(2)}`;
  const hit = lruHit(ECLIPSE_CACHE, key);
  if (hit) return hit;
  const loc = { latitude: coords.lat, longitude: coords.lon };
  let solar: IEclipseSummary | null = null;
  let lunar: IEclipseSummary | null = null;
  try {
    solar = summarizeEclipse(getUpcomingSolarEclipse(fromDate, loc, ECLIPSE_LOOK_AHEAD_DAYS));
  } catch (e) {
    if (e instanceof PanchangError) console.warn('[panchang]', e.code, e.message);
  }
  try {
    lunar = summarizeEclipse(getUpcomingLunarEclipse(fromDate, loc, ECLIPSE_LOOK_AHEAD_DAYS));
  } catch (e) {
    if (e instanceof PanchangError) console.warn('[panchang]', e.code, e.message);
  }
  const entry: EclipseCacheEntry = { solar, lunar };
  lruSet(ECLIPSE_CACHE, key, entry, ECLIPSE_CACHE_MAX);
  return entry;
}
