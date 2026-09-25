import type { Language } from 'panchang-ts';

import {
  fetchPanchangForToday,
  getCachedPanchangDay,
  FALLBACK_COORDS,
  deriveJanmaIndicesFromStore,
} from '@/services/astrology/panchangService';
import { useStore } from '@/store/useStore';
import { resolveLanguage } from '@/i18n';
import { toDevanagariDigits } from '@/utils/format';
import type { IPanchangDay } from '@/types';
import type { WidgetDay, WidgetPayload, WidgetSlot } from '@/types/widget';

import { DEFAULT_WIDGET_SLOTS, getWidgetField, type WidgetFieldId } from './widgetFields';

type Lang = 'en' | 'hi';
type UserSlots = [WidgetFieldId, WidgetFieldId, WidgetFieldId, WidgetFieldId];

// Deliberately local Records rather than i18next keys: this builder runs off
// the launch path (foreground refresh, settings, the widget's refresh route)
// and must never force a language bundle to load. Values mirror the widget
// spec §0 exactly — the renderers display them verbatim.
const TODAY_LABEL: Record<Lang, string> = {
  en: 'Today',
  hi: 'आज',
};

const TOMORROW_LABEL: Record<Lang, string> = {
  en: 'Tomorrow',
  hi: 'कल',
};

const STALE_LABEL: Record<Lang, string> = {
  en: 'Out of date',
  hi: 'पुराना डेटा',
};

const REFRESH_LABEL: Record<Lang, string> = {
  en: 'Refresh widget',
  hi: 'विजेट रिफ्रेश करें',
};

const OPEN_TO_UPDATE_LABEL: Record<Lang, string> = {
  en: 'Open Dharmagya to update',
  hi: 'अपडेट के लिए धर्मज्ञ खोलें',
};

/** Mirrors `home.untilTime` ('until {{time}}' / '{{time}} तक'). Hindi keeps
 *  its own word order; the renderers never split or re-assemble the string. */
function untilLabel(time: string, lang: Lang): string {
  return lang === 'hi' ? `${time} तक` : `until ${time}`;
}

function formatDate(d: Date, lang: Lang, useDevanagari: boolean, withYear: boolean): string {
  // en-IN, not en-US: day-before-month, matching the Home header and every
  // other date the app renders in English.
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (withYear) options.year = 'numeric';
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    // Fallback if Intl is unavailable in some bundle config ("Sun Sep 20 2026").
    const plain = d.toDateString();
    formatted = withYear ? plain : plain.slice(0, plain.lastIndexOf(' '));
  }
  // Intl emits Latin digits for both locales (hi-IN defaults to the `latn`
  // numbering system), so the numerals opt-in applies regardless of language
  // — exactly as the slot values do. Idempotent on Devanagari digits.
  return useDevanagari ? toDevanagariDigits(formatted) : formatted;
}

/** Device-local YYYY-MM-DD — what the renderers compare against the device's
 *  local date at draw time. */
function ymdOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildSlot(
  fieldId: WidgetFieldId,
  day: IPanchangDay | null,
  lang: Lang,
  useDevanagari: boolean,
): WidgetSlot {
  const field = getWidgetField(fieldId);
  if (!field) {
    return { id: fieldId, label: '—', value: '—', until: null };
  }
  if (!day) {
    // Compute failed for this day: keep the user's kickers so the layout is
    // stable, and dash the values.
    return { id: field.id, label: field.label(lang), value: '—', until: null };
  }
  const value = field.getValue(day, lang, useDevanagari);
  const rawUntil = field.getUntil ? field.getUntil(day, useDevanagari) : null;
  return {
    id: field.id,
    label: field.label(lang),
    value,
    until: rawUntil ? untilLabel(rawUntil, lang) : null,
  };
}

function buildDay(
  date: Date,
  day: IPanchangDay | null,
  userSlots: UserSlots,
  lang: Lang,
  useDevanagari: boolean,
): WidgetDay {
  return {
    ymd: ymdOf(date),
    dateLong: formatDate(date, lang, useDevanagari, true),
    dateShort: formatDate(date, lang, useDevanagari, false),
    slots: [
      buildSlot(userSlots[0], day, lang, useDevanagari),
      buildSlot(userSlots[1], day, lang, useDevanagari),
      buildSlot(userSlots[2], day, lang, useDevanagari),
      buildSlot(userSlots[3], day, lang, useDevanagari),
    ],
  };
}

/** Compose the v3 widget payload — `[today, tomorrow]` — from the store +
 *  panchang-ts. Always returns exactly two days: a day whose compute fails
 *  (the library can still return null on extreme inputs) is emitted with its
 *  correct `ymd` / dates and "—" values, so the renderers never see a
 *  one-entry array or a wrong-date day. */
export async function buildTodayWidgetPayload(): Promise<WidgetPayload> {
  const state = useStore.getState();
  const lang: Lang = resolveLanguage(state.language);
  const useDevanagari = state.useDevanagariNumerals;
  const coords = state.userLocation ?? FALLBACK_COORDS;
  const region = state.region ?? 'all';
  const ayanamsa = state.ayanamsa ?? 'lahiri';
  const { janmaNakshatra, janmaRashi } = deriveJanmaIndicesFromStore(state);
  const userSlots: UserSlots = state.widgetSlots ?? DEFAULT_WIDGET_SLOTS;

  const now = new Date();
  // Tomorrow = today + 1 calendar day in device-local time (`setDate` is
  // DST-safe; the wall-clock time is irrelevant — the service anchors the
  // compute to local noon at the place).
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);

  const today = await fetchPanchangForToday(
    coords, lang as Language, region, ayanamsa, janmaNakshatra, janmaRashi,
  );

  // One extra getDailyPanchang (~4–5 ms on a Pixel 3a), already off the launch
  // path. `getCachedPanchangDay` throws PanchangError on bad inputs where
  // `fetchPanchangForToday` swallows it — mirror that here.
  let tomorrow: IPanchangDay | null = null;
  try {
    tomorrow = getCachedPanchangDay(tomorrowDate, coords, {
      computeEndTimes: true,
      language: lang as Language,
      region,
      ayanamsa,
      janmaNakshatra,
      janmaRashi,
    });
  } catch (e) {
    console.warn('[widget] tomorrow compute failed', e);
    tomorrow = null;
  }

  return {
    v: 3,
    writtenAtMs: Date.now(),
    lang,
    theme: state.themeMode ?? 'system',
    isDarkMode: state.isDarkMode,
    todayLabel: TODAY_LABEL[lang],
    tomorrowLabel: TOMORROW_LABEL[lang],
    staleLabel: STALE_LABEL[lang],
    refreshLabel: REFRESH_LABEL[lang],
    openToUpdateLabel: OPEN_TO_UPDATE_LABEL[lang],
    locationLabel: state.locationName ?? null,
    days: [
      buildDay(now, today, userSlots, lang, useDevanagari),
      buildDay(tomorrowDate, tomorrow, userSlots, lang, useDevanagari),
    ],
  };
}
