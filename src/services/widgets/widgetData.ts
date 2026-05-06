import type { Language } from 'panchang-ts';

import { fetchPanchangForToday, FALLBACK_COORDS } from '@/services/astrology/panchangService';
import { useStore } from '@/store/useStore';
import { resolveLanguage } from '@/i18n';
import { toDevanagariDigits } from '@/utils/format';
import type { IPanchangElement } from '@/types';
import { type WidgetPayload, WIDGET_PLACEHOLDER } from '@/types/widget';

/** Localised label bundle. Mirrors the Sacred Editorial section labels but
 *  small-cap-styled in the widget XML, so we keep them plain here. */
const LABELS: Record<'en' | 'hi', WidgetPayload['labels'] & { today: string }> = {
  en: {
    today: 'Today',
    tithi: 'Tithi',
    nakshatra: 'Nakshatra',
    sunrise: 'Sunrise',
    rahuKalam: 'Rahu Kalam',
    until: 'until',
  },
  hi: {
    today: 'आज',
    tithi: 'तिथि',
    nakshatra: 'नक्षत्र',
    sunrise: 'सूर्योदय',
    rahuKalam: 'राहु काल',
    until: 'तक',
  },
};

function pickActive(elements: IPanchangElement[]): IPanchangElement | null {
  if (elements.length === 0) return null;
  return elements.find((e) => e.isActiveAtSunrise) ?? elements[0];
}

function applyDigits(s: string, useDevanagari: boolean): string {
  return useDevanagari ? toDevanagariDigits(s) : s;
}

function formatDateLong(d: Date, lang: 'en' | 'hi', useDevanagari: boolean): string {
  // Hindi locale already produces Devanagari digits via Intl. English locale
  // produces ASCII; we only convert when the user has explicitly opted in.
  const locale = lang === 'hi' ? 'hi-IN' : 'en-US';
  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
    if (lang === 'en' && useDevanagari) return toDevanagariDigits(formatted);
    return formatted;
  } catch {
    // Fallback if Intl is unavailable in some bundle config.
    return d.toDateString();
  }
}

function ymdOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Compose today's widget payload from the store + panchang-ts. Returns the
 *  placeholder if panchang compute fails (network-less, but library can still
 *  return null on extreme inputs). */
export async function buildTodayWidgetPayload(): Promise<WidgetPayload> {
  const state = useStore.getState();
  const lang: 'en' | 'hi' = resolveLanguage(state.language);
  const labelBundle = LABELS[lang];
  const useDevanagari = state.useDevanagariNumerals;
  const coords = state.userLocation ?? FALLBACK_COORDS;
  const region = state.region ?? 'all';
  const ayanamsa = state.ayanamsa ?? 'lahiri';

  const day = await fetchPanchangForToday(coords, lang as Language, region, ayanamsa);
  if (!day) {
    return { ...WIDGET_PLACEHOLDER, lang, todayLabel: labelBundle.today, isDarkMode: state.isDarkMode };
  }

  const tithi = pickActive(day.tithis);
  const nakshatra = pickActive(day.nakshatras);

  // panchang-ts returns the paksha-prefixed name (e.g. "Krishna Panchami" /
  // "कृष्ण पञ्चमी"). Don't prepend paksha again — duplicates the word.
  const tithiDisplay = tithi?.name ?? '—';

  const today = new Date();
  return {
    v: 1,
    ymd: ymdOf(today),
    writtenAtMs: Date.now(),
    lang,
    todayLabel: labelBundle.today,
    dateLong: formatDateLong(today, lang, useDevanagari),
    labels: {
      tithi: labelBundle.tithi,
      nakshatra: labelBundle.nakshatra,
      sunrise: labelBundle.sunrise,
      rahuKalam: labelBundle.rahuKalam,
      until: labelBundle.until,
    },
    tithiName: tithiDisplay,
    tithiEndTime: tithi?.endTime ? applyDigits(tithi.endTime, useDevanagari) : null,
    nakshatraName: nakshatra?.name ?? '—',
    nakshatraEndTime: nakshatra?.endTime ? applyDigits(nakshatra.endTime, useDevanagari) : null,
    sunrise: applyDigits(day.sunrise ?? '—', useDevanagari),
    rahuKalam:
      day.rahuKalamStart && day.rahuKalamEnd
        ? applyDigits(`${day.rahuKalamStart} – ${day.rahuKalamEnd}`, useDevanagari)
        : '—',
    locationLabel: state.locationName ?? null,
    isDarkMode: state.isDarkMode,
  };
}
