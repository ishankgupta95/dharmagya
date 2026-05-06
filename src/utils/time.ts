/**
 * Default IANA timezone used for any place that doesn't carry its own. The
 * curated city list ships only Indian district headquarters, all of which
 * sit in Asia/Kolkata.
 */
export const DEFAULT_BIRTH_TIMEZONE = 'Asia/Kolkata';

function offsetMinutesAt(timezone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const utcAsLocal = Date.UTC(
    Number(m.year), Number(m.month) - 1, Number(m.day),
    Number(m.hour), Number(m.minute), Number(m.second),
  );
  return Math.round((utcAsLocal - utcMs) / 60_000);
}

/**
 * Convert a wallclock date+time at an IANA timezone into the corresponding
 * UTC `Date`. Two-pass iteration handles DST transitions correctly.
 *
 * Use this whenever a birth time will be passed to panchang-ts — the library
 * expects a UTC instant, and `new Date('YYYY-MM-DDTHH:mm:00')` is interpreted
 * in the *device's* tz, not the birthplace's.
 */
export function wallclockInZoneToUtc(
  dateISO: string,
  hhmm: string,
  timezone: string,
): Date {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  if ([y, mo, d, hh, mm].some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid date or time: ${dateISO} ${hhmm}`);
  }
  const wallUtcMs = Date.UTC(y, mo - 1, d, hh, mm);
  let utcMs = wallUtcMs;
  for (let i = 0; i < 2; i++) {
    const offset = offsetMinutesAt(timezone, utcMs);
    utcMs = wallUtcMs - offset * 60_000;
  }
  return new Date(utcMs);
}
