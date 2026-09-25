import { useMemo } from 'react';

import { useStore, type TimeFormat } from '@/store/useStore';

/**
 * Cached `Intl.DateTimeFormat` instances, keyed by locale + options.
 *
 * Constructing a DateTimeFormat bridges to android.icu across JSI on Hermes,
 * so it is far more expensive than the format call itself — the same reason
 * `CalGridDense.makeCellDateFormatter` exists (measured 1.72 ms per 42-cell
 * pass constructing each time vs 0.08 ms reusing one). Screens that format a
 * date per row — the muhurat scan, the festivals browser — route through here
 * so a list pass constructs one formatter instead of one per row.
 */
const DATE_FORMAT_CACHE = new Map<string, Intl.DateTimeFormat>();

export function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = DATE_FORMAT_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    DATE_FORMAT_CACHE.set(key, formatter);
  }
  return formatter;
}

/** `date.toLocaleDateString(locale, options)` through the formatter cache. */
export function formatDateCached(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return getDateFormatter(locale, options).format(date);
}

const ASCII_TO_DEVANAGARI: Record<string, string> = {
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
};

/** Replace ASCII 0-9 with Devanagari ०-९. Non-digit characters pass through. */
export function toDevanagariDigits(str: string): string {
  return str.replace(/[0-9]/g, (d) => ASCII_TO_DEVANAGARI[d] ?? d);
}

export function formatNumber(value: number | string, useDevanagari: boolean): string {
  const s = typeof value === 'number' ? String(value) : value;
  return useDevanagari ? toDevanagariDigits(s) : s;
}

/**
 * Format a count with Indian digit grouping (1,00,000 not 100,000) and
 * optional Devanagari conversion. Use for jaap totals, milestone counts,
 * session totals — anywhere a large integer might reach lakhs.
 */
export function formatCount(value: number, useDevanagari: boolean): string {
  const grouped = value.toLocaleString('en-IN');
  return useDevanagari ? toDevanagariDigits(grouped) : grouped;
}

/** Format an HH:mm string per the user's time-format preference + numerals flag. */
export function formatTime(
  hhmm: string,
  opts: { timeFormat: TimeFormat; useDevanagari: boolean },
): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  const formatted = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: opts.timeFormat === 'auto' ? undefined : opts.timeFormat === '12h',
  });
  return opts.useDevanagari ? toDevanagariDigits(formatted) : formatted;
}

/** Format a Date as a localised time string. */
export function formatDateTime(
  d: Date,
  opts: { timeFormat: TimeFormat; useDevanagari: boolean },
): string {
  const formatted = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: opts.timeFormat === 'auto' ? undefined : opts.timeFormat === '12h',
  });
  return opts.useDevanagari ? toDevanagariDigits(formatted) : formatted;
}

/**
 * If `time` falls inside a wrap-aware quiet window, return the window's end
 * time today (or the next day if that's still in the past). Otherwise return
 * `time` unchanged. Pure function — no store reads.
 */
export function applyQuietHoursShift(
  time: Date,
  opts: { enabled: boolean; startHHmm: string; endHHmm: string },
): Date {
  if (!opts.enabled) return time;
  const [sh, sm] = opts.startHHmm.split(':').map((n) => parseInt(n, 10));
  const [eh, em] = opts.endHHmm.split(':').map((n) => parseInt(n, 10));
  if (![sh, sm, eh, em].every(Number.isFinite)) return time;

  const minuteOfDay = time.getHours() * 60 + time.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  // Wrap-around (e.g. 22:00 → 06:00) vs same-day (e.g. 13:00 → 15:00).
  const wraps = endMin <= startMin;
  const inWindow = wraps
    ? (minuteOfDay >= startMin || minuteOfDay < endMin)
    : (minuteOfDay >= startMin && minuteOfDay < endMin);

  if (!inWindow) return time;

  const shifted = new Date(time);
  // If the current minute is past the window's end (i.e. we're still in the
  // "late evening" half of a wrap window), the end time is tomorrow.
  if (wraps && minuteOfDay >= startMin) {
    shifted.setDate(shifted.getDate() + 1);
  }
  shifted.setHours(eh, em, 0, 0);
  return shifted;
}

/**
 * React hook returning formatters bound to the user's current preferences.
 *
 * Memoised on the two preferences it closes over: the returned object and its
 * closures are passed as props into `memo`'d components (`CalGridDense` takes
 * `digits`), and a fresh identity on every render defeats their shallow prop
 * compare — the 42-cell calendar rebuilt in full on every accordion toggle and
 * every 5-minute tick despite the memo that exists to prevent exactly that.
 */
export function useLocaleFormatters() {
  const useDevanagari = useStore((s) => s.useDevanagariNumerals);
  const timeFormat = useStore((s) => s.timeFormat);
  return useMemo(
    () => ({
      useDevanagari,
      timeFormat,
      formatNumber: (v: number | string) => formatNumber(v, useDevanagari),
      formatCount: (n: number) => formatCount(n, useDevanagari),
      formatTime: (hhmm: string) => formatTime(hhmm, { timeFormat, useDevanagari }),
      formatDateTime: (d: Date) => formatDateTime(d, { timeFormat, useDevanagari }),
      digits: (s: string) => (useDevanagari ? toDevanagariDigits(s) : s),
    }),
    [useDevanagari, timeFormat],
  );
}
