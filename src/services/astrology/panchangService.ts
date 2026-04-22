import * as Location from 'expo-location';
import {
  getDailyPanchang,
  computePlanetaryPositions,
  type DailyPanchangResult,
  type FestivalRegion,
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
  IBhadra,
  FestivalType,
} from '@/types';

export const FALLBACK_COORDS = { lat: 25.3176, lon: 83.0103 }; // Varanasi (Kashi)

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

const GRAHA_NAMES: Record<Language, Record<string, string>> = {
  en: { Sun: 'Sun', Moon: 'Moon', Mars: 'Mars', Mercury: 'Mercury', Jupiter: 'Jupiter', Venus: 'Venus', Saturn: 'Saturn', Rahu: 'Rahu', Ketu: 'Ketu' },
  hi: { Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध', Jupiter: 'बृहस्पति', Venus: 'शुक्र', Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु' },
};

// Dates from panchang-ts are offset-adjusted local display dates — read via getUTC*.
function formatTime(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toElements(items: { name: string; endTime: Date | null }[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatTime(item.endTime),
    endTimeMs: item.endTime?.getTime(),
  }));
}

function toQualitySlots(
  slots: DailyPanchangResult['choghadiya']['day'],
): IQualitySlot[] {
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

export function mapToPanchangDay(result: DailyPanchangResult): IPanchangDay {
  return {
    date: result.date,
    tithis: toElements(result.tithis),
    nakshatras: toElements(result.nakshatras),
    yogas: toElements(result.yogas),
    karanas: toElements(result.karanas),
    sunrise: formatTime(result.sunrise) ?? '—',
    sunset: formatTime(result.sunset) ?? '—',
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
    bhadra: mapBhadra(result.bhadra),
    eclipse: mapEclipse(result.eclipse),
    panchaka: result.panchaka,
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
): string {
  return `${ymdLocal(date)}|${lat.toFixed(4)}|${lon.toFixed(4)}|${language}|${region}`;
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
  opts: { computeEndTimes: boolean; language: Language; region: FestivalRegion },
): IPanchangDay | null {
  const key = dayCacheKey(date, coords.lat, coords.lon, opts.language, opts.region);
  const hit = lruHit(DAY_CACHE, key);
  if (hit && (hit.full || !opts.computeEndTimes)) return hit.day;

  const timezone = -new Date().getTimezoneOffset();
  const raw = getDailyPanchang(
    date,
    { latitude: coords.lat, longitude: coords.lon },
    { timezone, computeEndTimes: opts.computeEndTimes, language: opts.language, region: opts.region },
  );
  if (!raw) return null;
  const mapped = mapToPanchangDay(raw);
  lruSet(DAY_CACHE, key, { day: mapped, full: opts.computeEndTimes }, DAY_CACHE_MAX);
  return mapped;
}

export function getCachedGrahaPositions(date: Date, language: Language = 'en'): IGrahaPosition[] {
  const key = `${ymdLocal(date)}|${language}`;
  const hit = lruHit(GRAHA_CACHE, key);
  if (hit) return hit;
  const result = fetchGrahaPositions(date, language);
  lruSet(GRAHA_CACHE, key, result, GRAHA_CACHE_MAX);
  return result;
}

export function fetchGrahaPositions(date: Date, language: Language = 'en'): IGrahaPosition[] {
  const grahaNames = GRAHA_NAMES[language];
  const rashiNames = RASHI_NAMES[language];
  const nakshatraNames = NAKSHATRA_NAMES[language];
  const raw = computePlanetaryPositions(
    date,
    'lahiri',
    (idx) => nakshatraNames[idx],
    (idx) => rashiNames[idx],
  );
  const planets = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as const;
  return planets.map(key => {
    const p = (raw as Record<string, any>)[key];
    return {
      planet: grahaNames[p.planet] ?? p.planet,
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
  } catch {
    // fall through to fallback
  }
  return FALLBACK_COORDS;
}

export async function fetchPanchang(
  date: Date,
  savedCoords?: { lat: number; lon: number } | null,
  computeEndTimes = true,
  language: Language = 'en',
  region: FestivalRegion = 'all',
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    const timezone = -new Date().getTimezoneOffset();
    const result = getDailyPanchang(
      date,
      { latitude: coords.lat, longitude: coords.lon },
      { timezone, computeEndTimes, language, region },
    );
    if (!result) return null;
    return mapToPanchangDay(result);
  } catch {
    return null;
  }
}

export async function fetchPanchangForToday(
  savedCoords?: { lat: number; lon: number } | null,
  language: Language = 'en',
  region: FestivalRegion = 'all',
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    return getCachedPanchangDay(new Date(), coords, { computeEndTimes: true, language, region });
  } catch {
    return null;
  }
}
