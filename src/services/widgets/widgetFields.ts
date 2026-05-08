import type { IPanchangDay, IPanchangElement } from '@/types';

// Inlined here (rather than imported from `@/utils/format`) to keep this file
// a leaf module — `useStore` imports it for the WidgetFieldId union, and
// `utils/format` itself depends on `useStore`, so any import would re-enter
// the store and Metro warns about a require cycle with uninitialised values.
const ASCII_TO_DEVANAGARI: Record<string, string> = {
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
};
function toDevanagariDigits(str: string): string {
  return str.replace(/[0-9]/g, (d) => ASCII_TO_DEVANAGARI[d] ?? d);
}

export type WidgetFieldId =
  | 'tithi'
  | 'nakshatra'
  | 'yoga'
  | 'karana'
  | 'vara'
  | 'paksha'
  | 'masa'
  | 'sunrise'
  | 'sunset'
  | 'moonrise'
  | 'moonset'
  | 'rahuKalam'
  | 'gulika'
  | 'yamaganda'
  | 'abhijit'
  | 'brahmaMuhurta';

export interface WidgetField {
  id: WidgetFieldId;
  /** Localised short label for the slot kicker (e.g. "Tithi" / "तिथि"). The
   *  widget XML renders it small-cap-styled so we keep the source Title Case. */
  label: (lang: 'en' | 'hi') => string;
  /** Primary display string for the slot (e.g. "Krishna Panchami"). */
  getValue: (day: IPanchangDay, lang: 'en' | 'hi', useDevanagari: boolean) => string;
  /** Optional "until X" suffix. Returns null when the field is a fixed window
   *  or doesn't expire (e.g. Sunrise, Vara). */
  getUntil?: (day: IPanchangDay, useDevanagari: boolean) => string | null;
}

const LABELS: Record<WidgetFieldId, { en: string; hi: string }> = {
  tithi: { en: 'Tithi', hi: 'तिथि' },
  nakshatra: { en: 'Nakshatra', hi: 'नक्षत्र' },
  yoga: { en: 'Yoga', hi: 'योग' },
  karana: { en: 'Karana', hi: 'करण' },
  vara: { en: 'Vara', hi: 'वार' },
  paksha: { en: 'Paksha', hi: 'पक्ष' },
  masa: { en: 'Masa', hi: 'मास' },
  sunrise: { en: 'Sunrise', hi: 'सूर्योदय' },
  sunset: { en: 'Sunset', hi: 'सूर्यास्त' },
  moonrise: { en: 'Moonrise', hi: 'चन्द्रोदय' },
  moonset: { en: 'Moonset', hi: 'चन्द्रास्त' },
  rahuKalam: { en: 'Rahu Kalam', hi: 'राहु काल' },
  gulika: { en: 'Gulika', hi: 'गुलिक' },
  yamaganda: { en: 'Yamaganda', hi: 'यमगण्ड' },
  abhijit: { en: 'Abhijit', hi: 'अभिजित' },
  brahmaMuhurta: { en: 'Brahma', hi: 'ब्रह्म' },
};

const PAKSHA_LOCALISED: Record<'Shukla' | 'Krishna', { en: string; hi: string }> = {
  Shukla: { en: 'Shukla', hi: 'शुक्ल' },
  Krishna: { en: 'Krishna', hi: 'कृष्ण' },
};

function pickActive(elements: IPanchangElement[]): IPanchangElement | null {
  if (elements.length === 0) return null;
  return elements.find((e) => e.isActiveAtSunrise) ?? elements[0];
}

function digits(s: string, useDevanagari: boolean): string {
  return useDevanagari ? toDevanagariDigits(s) : s;
}

function rangeOrDash(
  start: string | undefined,
  end: string | undefined,
  useDevanagari: boolean,
): string {
  if (!start || !end) return '—';
  return digits(`${start} – ${end}`, useDevanagari);
}

function elementUntil(
  el: IPanchangElement | null,
  useDevanagari: boolean,
): string | null {
  if (!el?.endTime) return null;
  return digits(el.endTime, useDevanagari);
}

const FIELDS: Record<WidgetFieldId, WidgetField> = {
  tithi: {
    id: 'tithi',
    label: (l) => LABELS.tithi[l],
    getValue: (day) => pickActive(day.tithis)?.name ?? '—',
    getUntil: (day, dv) => elementUntil(pickActive(day.tithis), dv),
  },
  nakshatra: {
    id: 'nakshatra',
    label: (l) => LABELS.nakshatra[l],
    getValue: (day) => pickActive(day.nakshatras)?.name ?? '—',
    getUntil: (day, dv) => elementUntil(pickActive(day.nakshatras), dv),
  },
  yoga: {
    id: 'yoga',
    label: (l) => LABELS.yoga[l],
    getValue: (day) => pickActive(day.yogas)?.name ?? '—',
    getUntil: (day, dv) => elementUntil(pickActive(day.yogas), dv),
  },
  karana: {
    id: 'karana',
    label: (l) => LABELS.karana[l],
    getValue: (day) => pickActive(day.karanas)?.name ?? '—',
    getUntil: (day, dv) => elementUntil(pickActive(day.karanas), dv),
  },
  vara: {
    id: 'vara',
    label: (l) => LABELS.vara[l],
    getValue: (day) => day.vara ?? '—',
  },
  paksha: {
    id: 'paksha',
    label: (l) => LABELS.paksha[l],
    getValue: (day, lang) => {
      const p = pickActive(day.tithis)?.paksha;
      if (!p) return '—';
      return PAKSHA_LOCALISED[p][lang];
    },
  },
  masa: {
    id: 'masa',
    label: (l) => LABELS.masa[l],
    getValue: (day) => day.hinduMonth ?? day.masa ?? '—',
  },
  sunrise: {
    id: 'sunrise',
    label: (l) => LABELS.sunrise[l],
    getValue: (day, _l, dv) => digits(day.sunrise ?? '—', dv),
  },
  sunset: {
    id: 'sunset',
    label: (l) => LABELS.sunset[l],
    getValue: (day, _l, dv) => digits(day.sunset ?? '—', dv),
  },
  moonrise: {
    id: 'moonrise',
    label: (l) => LABELS.moonrise[l],
    getValue: (day, _l, dv) => digits(day.moonrise ?? '—', dv),
  },
  moonset: {
    id: 'moonset',
    label: (l) => LABELS.moonset[l],
    getValue: (day, _l, dv) => digits(day.moonset ?? '—', dv),
  },
  rahuKalam: {
    id: 'rahuKalam',
    label: (l) => LABELS.rahuKalam[l],
    getValue: (day, _l, dv) => rangeOrDash(day.rahuKalamStart, day.rahuKalamEnd, dv),
  },
  gulika: {
    id: 'gulika',
    label: (l) => LABELS.gulika[l],
    getValue: (day, _l, dv) => rangeOrDash(day.gulikaKalamStart, day.gulikaKalamEnd, dv),
  },
  yamaganda: {
    id: 'yamaganda',
    label: (l) => LABELS.yamaganda[l],
    getValue: (day, _l, dv) => rangeOrDash(day.yamagandaStart, day.yamagandaEnd, dv),
  },
  abhijit: {
    id: 'abhijit',
    label: (l) => LABELS.abhijit[l],
    getValue: (day, _l, dv) => rangeOrDash(day.abhijitMuhurtaStart, day.abhijitMuhurtaEnd, dv),
  },
  brahmaMuhurta: {
    id: 'brahmaMuhurta',
    label: (l) => LABELS.brahmaMuhurta[l],
    getValue: (day, _l, dv) => rangeOrDash(day.brahmaMuhurtaStart, day.brahmaMuhurtaEnd, dv),
  },
};

export const WIDGET_FIELD_IDS: WidgetFieldId[] = [
  'tithi',
  'nakshatra',
  'yoga',
  'karana',
  'vara',
  'paksha',
  'masa',
  'sunrise',
  'sunset',
  'moonrise',
  'moonset',
  'rahuKalam',
  'gulika',
  'yamaganda',
  'abhijit',
  'brahmaMuhurta',
];

export function getWidgetField(id: string): WidgetField | null {
  return (FIELDS as Record<string, WidgetField | undefined>)[id] ?? null;
}

export const DEFAULT_WIDGET_SLOTS: [WidgetFieldId, WidgetFieldId, WidgetFieldId, WidgetFieldId] = [
  'tithi',
  'nakshatra',
  'sunrise',
  'rahuKalam',
];
