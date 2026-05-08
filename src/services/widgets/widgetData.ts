import type { Language } from 'panchang-ts';

import {
  fetchPanchangForToday,
  FALLBACK_COORDS,
  deriveJanmaIndicesFromStore,
} from '@/services/astrology/panchangService';
import { useStore } from '@/store/useStore';
import { resolveLanguage } from '@/i18n';
import { toDevanagariDigits } from '@/utils/format';
import type { IPanchangDay } from '@/types';
import { type WidgetPayload, type WidgetSlot, WIDGET_PLACEHOLDER } from '@/types/widget';

import { DEFAULT_WIDGET_SLOTS, getWidgetField, type WidgetFieldId } from './widgetFields';

const TODAY_LABEL: Record<'en' | 'hi', string> = {
  en: 'Today',
  hi: 'आज',
};

const UNTIL_LABEL: Record<'en' | 'hi', string> = {
  en: 'until',
  hi: 'तक',
};

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

function buildSlot(
  fieldId: WidgetFieldId,
  day: IPanchangDay,
  lang: 'en' | 'hi',
  useDevanagari: boolean,
): WidgetSlot {
  const field = getWidgetField(fieldId);
  if (!field) {
    return { id: fieldId, label: '—', value: '—', until: null };
  }
  const value = field.getValue(day, lang, useDevanagari);
  const rawUntil = field.getUntil ? field.getUntil(day, useDevanagari) : null;
  const until = rawUntil ? `${UNTIL_LABEL[lang]} ${rawUntil}` : null;
  return {
    id: field.id,
    label: field.label(lang),
    value,
    until,
  };
}

/** Compose today's widget payload from the store + panchang-ts. Returns the
 *  placeholder if panchang compute fails (network-less, but library can still
 *  return null on extreme inputs). */
export async function buildTodayWidgetPayload(): Promise<WidgetPayload> {
  const state = useStore.getState();
  const lang: 'en' | 'hi' = resolveLanguage(state.language);
  const useDevanagari = state.useDevanagariNumerals;
  const coords = state.userLocation ?? FALLBACK_COORDS;
  const region = state.region ?? 'all';
  const ayanamsa = state.ayanamsa ?? 'lahiri';
  const { janmaNakshatra, janmaRashi } = deriveJanmaIndicesFromStore(state);

  const day = await fetchPanchangForToday(
    coords, lang as Language, region, ayanamsa, janmaNakshatra, janmaRashi,
  );
  if (!day) {
    return {
      ...WIDGET_PLACEHOLDER,
      lang,
      todayLabel: TODAY_LABEL[lang],
      isDarkMode: state.isDarkMode,
    };
  }

  const userSlots = state.widgetSlots ?? DEFAULT_WIDGET_SLOTS;
  const slots = [
    buildSlot(userSlots[0], day, lang, useDevanagari),
    buildSlot(userSlots[1], day, lang, useDevanagari),
    buildSlot(userSlots[2], day, lang, useDevanagari),
    buildSlot(userSlots[3], day, lang, useDevanagari),
  ] as WidgetPayload['slots'];

  const today = new Date();
  return {
    v: 2,
    ymd: ymdOf(today),
    writtenAtMs: Date.now(),
    lang,
    todayLabel: TODAY_LABEL[lang],
    dateLong: formatDateLong(today, lang, useDevanagari),
    slots,
    locationLabel: state.locationName ?? null,
    isDarkMode: state.isDarkMode,
  };
}
