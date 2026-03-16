import * as Location from 'expo-location';
import {
  getPanchangam,
  Observer,
  tithiNames,
  nakshatraNames,
  yogaNames,
  dayNames,
} from '@ishubhamx/panchangam-js';

import { IPanchangDay } from '@/types';

const FALLBACK = { lat: 18.6298, lon: 73.7997 };
const ELEVATION = 560; // metres (Pune default)
const TIMEZONE_OFFSET = 330; // IST = +5:30

function formatTime(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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
  return FALLBACK;
}

export async function fetchPanchang(
  date: Date,
  savedCoords?: { lat: number; lon: number } | null,
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    const observer = new Observer(coords.lat, coords.lon, ELEVATION);
    const result = getPanchangam(date, observer, { timezoneOffset: TIMEZONE_OFFSET });

    return {
      date,
      tithi: tithiNames[result.tithi] ?? String(result.tithi),
      nakshatra: nakshatraNames[result.nakshatra] ?? String(result.nakshatra),
      yoga: yogaNames[result.yoga] ?? String(result.yoga),
      karana: result.karana,
      sunrise: formatTime(result.sunrise) ?? '—',
      sunset: formatTime(result.sunset) ?? '—',
      tithiEndTime: formatTime(result.tithiEndTime),
      nakshatraEndTime: formatTime(result.nakshatraEndTime),
      yogaEndTime: formatTime(result.yogaEndTime),
      rahuKalamStart: formatTime(result.rahuKalamStart),
      rahuKalamEnd: formatTime(result.rahuKalamEnd),
      vara: dayNames[result.vara] ?? undefined,
      hinduMonth: (result.masa as { name: string } | undefined)?.name,
      vikramSamvat: (result.samvat as { vikram: number } | undefined)?.vikram,
    };
  } catch {
    return null;
  }
}

export async function fetchPanchangForToday(
  savedCoords?: { lat: number; lon: number } | null,
): Promise<IPanchangDay | null> {
  return fetchPanchang(new Date(), savedCoords);
}
