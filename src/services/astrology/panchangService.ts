import * as Location from 'expo-location';
import {
  getDailyPanchang,
  computePlanetaryPositions,
  type DailyPanchangResult,
} from 'panchang-ts';

import type {
  IPanchangDay,
  IPanchangElement,
  IQualitySlot,
  IHoraSlot,
  IGrahaPosition,
} from '@/types';

export const FALLBACK_COORDS = { lat: 18.6298, lon: 73.7997 }; // Pune

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

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
    vara: result.vara.englishName,
    hinduMonth: result.chandramasa.name,
    masa: result.masa?.name,
    vikramSamvat: result.samvat.vikramSamvat,
    shakaSamvat: result.samvat.shakaSamvat,
    chandraRashi: result.chandraRashi.name,
    suryaNakshatra: result.suryaNakshatra.name,
    moonrise: formatTime(result.moonrise),
    moonset: formatTime(result.moonset),
    brahmaMuhurtaStart: formatTime(result.brahmaMuhurta.start),
    brahmaMuhurtaEnd: formatTime(result.brahmaMuhurta.end),
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
    festivals: result.festivals.map(f => ({ name: f.name })),
  };
}

export function fetchGrahaPositions(date: Date): IGrahaPosition[] {
  const raw = computePlanetaryPositions(date, 'lahiri');
  const planets = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as const;
  return planets.map(key => {
    const p = (raw as Record<string, any>)[key];
    return {
      planet: p.planet,
      rashi: RASHI_NAMES[p.rashi.index] ?? p.rashi.name,
      degreeInRashi: Math.round(p.degreeInRashi * 100) / 100,
      nakshatra: NAKSHATRA_NAMES[p.nakshatra.index] ?? p.nakshatra.name,
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
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    const timezone = -new Date().getTimezoneOffset();
    const result = getDailyPanchang(
      date,
      { latitude: coords.lat, longitude: coords.lon },
      { timezone, computeEndTimes },
    );
    return mapToPanchangDay(result);
  } catch {
    return null;
  }
}

export async function fetchPanchangForToday(
  savedCoords?: { lat: number; lon: number } | null,
): Promise<IPanchangDay | null> {
  return fetchPanchang(new Date(), savedCoords);
}
