import * as Location from 'expo-location';
import { getDailyPanchang, type DailyPanchangResult } from 'panchang-ts';

import type { IPanchangDay, IPanchangElement } from '@/types';

export const FALLBACK_COORDS = { lat: 18.6298, lon: 73.7997 }; // Pune

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
    vara: result.vara.englishName,
    hinduMonth: result.masa.name,
    // vikramSamvat not yet available in panchang-ts v0.1.0
    vikramSamvat: undefined,
  };
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
