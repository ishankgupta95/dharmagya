import { useStore, type TimeFormat } from '@/store/useStore';

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

/** React hook returning formatters bound to the user's current preferences. */
export function useLocaleFormatters() {
  const useDevanagari = useStore((s) => s.useDevanagariNumerals);
  const timeFormat = useStore((s) => s.timeFormat);
  return {
    useDevanagari,
    timeFormat,
    formatNumber: (v: number | string) => formatNumber(v, useDevanagari),
    formatTime: (hhmm: string) => formatTime(hhmm, { timeFormat, useDevanagari }),
    formatDateTime: (d: Date) => formatDateTime(d, { timeFormat, useDevanagari }),
    digits: (s: string) => (useDevanagari ? toDevanagariDigits(s) : s),
  };
}
