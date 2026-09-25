import { offsetMinutesForZone } from '@/utils/time';

/**
 * Short names for the zones a panchang is most likely to be rendered in while
 * the phone sits somewhere else. Keyed by zone, then by the UTC offset in
 * minutes east, so a DST zone gets the right half of its pair ("EST" in
 * January, "EDT" in July), and an offset the table does not expect (a zone
 * that changed its rules) drops through to the GMT form instead of printing a
 * wrong name.
 *
 * A table, not `Intl.DateTimeFormat({ timeZoneName: 'short' })`: Hermes/ICU
 * gives "GMT+5:30" rather than "IST" for most locales, including en-IN and
 * hi-IN, so the name users actually recognise has to come from here. Names
 * that are ambiguous across regions (Bangladesh vs British "BST", Irish vs
 * Indian "IST", Sri Lanka) are left out on purpose and fall back to GMT±h:mm.
 */
const ZONE_ABBR: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  'Asia/Kolkata': { 330: 'IST' },
  'Asia/Calcutta': { 330: 'IST' },
  'Asia/Kathmandu': { 345: 'NPT' },
  'Asia/Katmandu': { 345: 'NPT' },
  'Asia/Karachi': { 300: 'PKT' },
  'Asia/Dubai': { 240: 'GST' },
  'Asia/Muscat': { 240: 'GST' },
  'Asia/Singapore': { 480: 'SGT' },
  'Asia/Kuala_Lumpur': { 480: 'MYT' },
  'Asia/Tokyo': { 540: 'JST' },
  'Africa/Johannesburg': { 120: 'SAST' },
  'Africa/Nairobi': { 180: 'EAT' },
  'Europe/London': { 0: 'GMT', 60: 'BST' },
  'Europe/Berlin': { 60: 'CET', 120: 'CEST' },
  'Europe/Paris': { 60: 'CET', 120: 'CEST' },
  'Europe/Amsterdam': { 60: 'CET', 120: 'CEST' },
  'America/New_York': { [-300]: 'EST', [-240]: 'EDT' },
  'America/Toronto': { [-300]: 'EST', [-240]: 'EDT' },
  'America/Chicago': { [-360]: 'CST', [-300]: 'CDT' },
  'America/Denver': { [-420]: 'MST', [-360]: 'MDT' },
  'America/Phoenix': { [-420]: 'MST' },
  'America/Los_Angeles': { [-480]: 'PST', [-420]: 'PDT' },
  'America/Vancouver': { [-480]: 'PST', [-420]: 'PDT' },
  'Australia/Sydney': { 600: 'AEST', 660: 'AEDT' },
  'Australia/Melbourne': { 600: 'AEST', 660: 'AEDT' },
  'Pacific/Auckland': { 720: 'NZST', 780: 'NZDT' },
  UTC: { 0: 'UTC' },
  'Etc/UTC': { 0: 'UTC' },
};

/** "GMT+5:30", "GMT-4:00", or "GMT" at zero. */
export function gmtOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'GMT';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}:${m < 10 ? `0${m}` : m}`;
}

/** The curated short name for `zone` at `offsetMinutes`, else the GMT form. */
export function shortZoneName(zone: string, offsetMinutes: number): string {
  const byOffset = ZONE_ABBR[zone];
  const abbr = byOffset ? byOffset[offsetMinutes] : undefined;
  return abbr ?? gmtOffsetLabel(offsetMinutes);
}

/**
 * Coordinates as the panchang compute receives them. Structural rather than
 * imported from panchangService, so this module stays a leaf that the service's
 * native dependencies are not pulled in behind.
 */
export interface ZoneLabelCoords {
  lat: number;
  lon: number;
  timezone?: string;
}

/** Same place by value: a stored copy of the fallback is the fallback. */
function samePlace(a: ZoneLabelCoords, b: ZoneLabelCoords): boolean {
  return a.lat === b.lat && a.lon === b.lon && a.timezone === b.timezone;
}

/**
 * The zone to print beside a panchang's times, or null when none is needed.
 *
 * `coords` is the stored place (null when the user has none) and `fallback`
 * the coordinates the compute substitutes for "none" (`FALLBACK_COORDS`), so
 * the zone resolved here is the one the times were actually RENDERED in: the
 * fallback carries Asia/Kolkata, a chosen city carries its own, and a live GPS
 * fix carries none because the device is standing there. That is exactly the
 * rule `timezoneMinutesFor` in panchangService applies, so a missing zone (or
 * one `Intl` cannot resolve, where the service also falls back to the device
 * offset) means "device clock" and gets no label.
 *
 * Two triggers, either one enough:
 *  - the times are the fallback's: the user never chose that place, so its
 *    zone is stated even on a phone that happens to share it;
 *  - the place's offset differs from the phone's, so the times would
 *    otherwise read as local.
 *
 * Offsets are compared at local noon of `day`, the same instant the service
 * resolves the day's offset at, so a DST boundary cannot make the label
 * disagree with the times beside it. Comparing offsets rather than zone names
 * keeps an alias (Asia/Calcutta on the phone, Asia/Kolkata on the place) or a
 * same-offset neighbour from printing a label that changes nothing.
 *
 * `deviceOffsetMinutes` defaults to the phone's own offset at that noon; it is
 * a parameter only so the function can be exercised without changing TZ.
 */
export function timezoneLabel(
  coords: ZoneLabelCoords | null | undefined,
  fallback: ZoneLabelCoords,
  day: Date,
  deviceOffsetMinutes?: number,
): string | null {
  const place = coords ?? fallback;
  const zone = place.timezone;
  if (!zone) return null;
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  const placeOffset = offsetMinutesForZone(zone, noon);
  if (placeOffset === null) return null;
  const deviceOffset = deviceOffsetMinutes === undefined ? -noon.getTimezoneOffset() : deviceOffsetMinutes;
  if (placeOffset === deviceOffset && !samePlace(place, fallback)) return null;
  return shortZoneName(zone, placeOffset);
}
