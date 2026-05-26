/**
 * Navratri — date + colour + Ghatasthapana muhurat computation (Phase 14.3).
 *
 * Day-1 dates come from `src/data/static/festivals.json` (already pre-generated
 * via `npm run generate:festivals`) — `Sharad Navaratri` for Sharad,
 * `Rama Navami − 8 days` for Chaitra (Rama Navami is canonical Navratri Day 9).
 * Days 2..9 are simple `+N days` arithmetic. The only panchang-ts call left in
 * this file is the **one** `getDailyPanchang` we need for the Ghatasthapana
 * muhurat window + Chitra/Vaidhriti caption flags on Day 1.
 *
 * **Why no `convertHinduToGregorian` here:** the earlier draft of this service
 * computed each Day-N date via panchang-ts tithi-by-tithi (~18 sync calls,
 * ~1–2 s on the JS thread). That was wasted work — the same dates are already
 * baked into `festivals.json`. The lookup version below is O(days-in-year) and
 * runs in under a millisecond.
 */

import {
  getDailyPanchang,
  PanchangError,
  type AyanamsaType,
  type DailyPanchangResult,
  type DailyTithiInfo,
  type DailyNakshatraInfo,
  type DailyYogaInfo,
  type MasaSystem,
} from 'panchang-ts';

import {
  NAVADURGA_FORMS,
  type Bilingual,
  type NavratriKind,
  type NavadurgaForm,
} from '@/config/navratri';
import { FALLBACK_COORDS } from './panchangService';
import festivalsData from '@/data/static/festivals.json';

// ─── Result types ────────────────────────────────────────────────────────────

/** A single day of the Navratri window. */
export interface NavratriDay {
  /** 1..9 — Navratri day number. */
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** The Gregorian date the day falls on, at local-midnight. */
  date: Date;
  /** The Navadurga form worshipped on this day. */
  form: NavadurgaForm;
  /** Computed colour per the weekday-anchored 9-day cycle. */
  color: NavratriColor;
}

/** One day's colour. Hex + bilingual name. */
export interface NavratriColor {
  hex: string;
  name: Bilingual;
  /** True when this is a "secondary" colour because the weekday recurs (Days 8 & 9). */
  isSecondary: boolean;
}

/** The full computed Navratri window. */
export interface NavratriWindow {
  kind: NavratriKind;
  /** True when today is somewhere within Day 1 .. Day 9. */
  isActive: boolean;
  /** 1..9 if `isActive`, else `null`. */
  currentDay: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;
  /** Day 1 → Day 9. Always 9 entries; missing tithis (kshaya) fall back to Day 1 + (N-1). */
  days: NavratriDay[];
  /** Day 10 — Vijayadashami / Dussehra. */
  vijayadashami: Date;
}

/** Ghatasthapana muhurat for Day 1 of a (Sharad/Chaitra) Navratri. */
export interface GhatasthapanaMuhurat {
  /** Window start (sunrise of Day 1). */
  start: Date;
  /** Window end — `min(firstThirdOfDay, pratipadaEnd)`. */
  end: Date;
  /**
   * True when Pratipada wasn't active at sunrise — the classical fallback to
   * Abhijit muhurta applies. `start`/`end` then reflect Abhijit's window.
   * (Abhijit is `null` on Wednesdays per Smarta convention — `null` propagates.)
   */
  isAbhijitFallback: boolean;
  /**
   * Day 1 sunrise + sunset (always returned — surfaced to context the window
   * in the UI even when the muhurat window itself is narrow).
   */
  sunrise: Date;
  sunset: Date;
  /**
   * Pratipada end-time (when the lunar tithi ends). Useful as caption — the
   * muhurat window cannot extend past this.
   */
  pratipadaEnd: Date | null;
  /**
   * Diagnostic flags — Chitra-nakshatra and Vaidhriti-yoga during the muhurat
   * window are classically advised against (not prohibited). Surfaced as a
   * caption, not blocked.
   */
  warnings: {
    chitra: boolean;
    vaidhriti: boolean;
  };
}

// ─── Colour cycle ─────────────────────────────────────────────────────────────
// Each weekday has a primary colour (the published "fasting colour"); when
// the weekday recurs on Day 8 or 9 of Navratri, a secondary colour is used.
//
// Verified against published Navadurga calendars for multiple
// years (e.g. Sharad 2023 started on Sunday → Day 8 was Purple, Day 9 Peacock
// Green; Sharad 2024 started on Thursday → Day 8 was Pink, Day 9 Purple).
// The rule: PRIMARY[weekday] for the first appearance of the weekday in
// Days 1..9; SECONDARY[weekday] for the second appearance (always Days 8/9
// since Navratri is 9 days, 2 more than a week).

const PRIMARY_COLOR: Record<number, NavratriColor> = {
  0: { hex: '#E8893C', name: { en: 'Orange',     hi: 'नारंगी' }, isSecondary: false }, // Sun
  1: { hex: '#F6F2E8', name: { en: 'White',      hi: 'श्वेत' },  isSecondary: false }, // Mon
  2: { hex: '#C13B22', name: { en: 'Red',        hi: 'लाल' },    isSecondary: false }, // Tue
  3: { hex: '#2C5BA8', name: { en: 'Royal Blue', hi: 'नीला' },   isSecondary: false }, // Wed
  4: { hex: '#E0B43C', name: { en: 'Yellow',     hi: 'पीला' },   isSecondary: false }, // Thu
  5: { hex: '#3E8A4A', name: { en: 'Green',      hi: 'हरा' },    isSecondary: false }, // Fri
  6: { hex: '#5C5C5C', name: { en: 'Grey',       hi: 'धूसर' },   isSecondary: false }, // Sat
};

const SECONDARY_COLOR: Record<number, NavratriColor> = {
  0: { hex: '#6B3B8B', name: { en: 'Purple',        hi: 'बैंगनी' },    isSecondary: true }, // Sun → Day 8
  1: { hex: '#1F8A7A', name: { en: 'Peacock Green', hi: 'मयूर हरा' },  isSecondary: true }, // Mon → Day 8/9
  2: { hex: '#E66BAA', name: { en: 'Pink',          hi: 'गुलाबी' },    isSecondary: true }, // Tue
  3: { hex: '#7A9B5E', name: { en: 'Sap Green',     hi: 'गहरा हरा' },  isSecondary: true }, // Wed
  4: { hex: '#E66BAA', name: { en: 'Pink',          hi: 'गुलाबी' },    isSecondary: true }, // Thu
  5: { hex: '#6B3B8B', name: { en: 'Purple',        hi: 'बैंगनी' },    isSecondary: true }, // Fri
  6: { hex: '#A57430', name: { en: 'Khaki',         hi: 'खाकी' },      isSecondary: true }, // Sat
};

/**
 * Compute the colour for each of 9 Navratri days, anchored at Day 1's weekday.
 *
 * For Day N: the weekday is `(day1Weekday + N - 1) % 7`. The first time a
 * weekday appears in the run gets `PRIMARY_COLOR[weekday]`; the second time
 * (Day 8 or 9) gets `SECONDARY_COLOR[weekday]`.
 */
export function computeNavadurgaColors(day1Date: Date): NavratriColor[] {
  const day1Weekday = day1Date.getDay();
  const colors: NavratriColor[] = [];
  const seenWeekdays = new Set<number>();
  for (let i = 0; i < 9; i++) {
    const weekday = (day1Weekday + i) % 7;
    if (seenWeekdays.has(weekday)) {
      colors.push(SECONDARY_COLOR[weekday]);
    } else {
      seenWeekdays.add(weekday);
      colors.push(PRIMARY_COLOR[weekday]);
    }
  }
  return colors;
}

// ─── Date computation ────────────────────────────────────────────────────────
// Day-1 dates come from the pre-generated `festivals.json`. Days 2..9 are
// simple `+N days` arithmetic. Vijayadashami / Day 10 also comes from
// `festivals.json` ("Dussehra"). No panchang-ts calls for dates.

/** Strip time to local midnight. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Same calendar day, ignoring time. */
function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

interface RawFestivalDay {
  date: string;
  festivals: { name: string; type: string }[];
}

/** Lookup a festival by exact `name` in a given Gregorian year. Returns the local-midnight Date or null. */
function festivalDateInYear(year: number, name: string): Date | null {
  const yearData = (festivalsData as Record<string, RawFestivalDay[]>)[String(year)];
  if (!yearData) return null;
  for (const day of yearData) {
    if (day.festivals.some(f => f.name === name)) {
      return new Date(day.date + 'T00:00:00');
    }
  }
  return null;
}

/**
 * Resolve a Navratri kind to its Day-1 Gregorian date in a calendar year,
 * using the static festivals catalogue:
 *   - **sharad** → "Sharad Navaratri" entry (Day 1 of Sharad).
 *   - **chaitra** → "Rama Navami" minus 8 days (Rama Navami = Chaitra Day 9).
 *   - **magha-gupt / ashadha-gupt** → not in `festivals.json`; returns null
 *     (the UI shows these as info-card-only, with no per-day dates).
 */
function day1ForKind(kind: NavratriKind, year: number): Date | null {
  switch (kind) {
    case 'sharad':
      return festivalDateInYear(year, 'Sharad Navaratri');
    case 'chaitra': {
      const ramaNavami = festivalDateInYear(year, 'Rama Navami');
      if (!ramaNavami) return null;
      const d = new Date(ramaNavami);
      d.setDate(d.getDate() - 8);
      return d;
    }
    case 'magha-gupt':
    case 'ashadha-gupt':
      return null;
  }
}

export interface NavratriOpts {
  /** Defaults to `FALLBACK_COORDS` (Varanasi). Used only by Ghatasthapana muhurat. */
  coords?: { lat: number; lon: number };
  /** Defaults to the device timezone. Used only by Ghatasthapana muhurat. */
  timezone?: number;
  /** Defaults to `'lahiri'`. Used only by Ghatasthapana muhurat. */
  ayanamsa?: AyanamsaType;
  /** Defaults to `'purnimanta'`. Currently unused; kept for API compat. */
  masaSystem?: MasaSystem;
}

function localTimezoneMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function resolveOpts(opts?: NavratriOpts) {
  return {
    coords: opts?.coords ?? FALLBACK_COORDS,
    timezone: opts?.timezone ?? localTimezoneMinutes(),
    ayanamsa: opts?.ayanamsa ?? ('lahiri' as AyanamsaType),
  };
}

/**
 * Compute the 9-day window for a given Navratri kind in a given Gregorian
 * year. Reads Day-1 from `festivals.json`; Days 2..9 + Day 10 are derived.
 *
 * Returns `null` for the Gupt Navratris (kept info-card-only — see the kind
 * toggle behaviour in `app/navratri/index.tsx`).
 */
export function computeNavratriDates(
  kind: NavratriKind,
  year: number,
  // The third arg is accepted but ignored — kept so existing call sites
  // (festivals screen, navratri screen, reminderScheduler) don't break.
  _opts?: NavratriOpts,
): NavratriWindow | null {
  const day1 = day1ForKind(kind, year);
  if (!day1) return null;
  const day1Local = startOfLocalDay(day1);

  const dates: Date[] = [];
  for (let i = 0; i < 9; i++) {
    const d = new Date(day1Local);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  // Day 10 — Vijayadashami. Use the "Dussehra" entry when present, else
  // Day 9 + 1 day (the calendar-day default; the aparahna refinement
  // is a separate concern).
  const dussehra = festivalDateInYear(year, 'Dussehra');
  const vijayadashami = dussehra ? startOfLocalDay(dussehra) : (() => {
    const d = new Date(dates[8]);
    d.setDate(d.getDate() + 1);
    return d;
  })();

  const colors = computeNavadurgaColors(day1Local);

  const today = startOfLocalDay(new Date());
  const isActive = today.getTime() >= dates[0].getTime() &&
    today.getTime() <= dates[8].getTime();
  const currentDay = isActive
    ? (dates.findIndex(d => sameLocalDay(d, today)) + 1) as (1|2|3|4|5|6|7|8|9)
    : null;

  return {
    kind,
    isActive,
    currentDay: isActive && currentDay && currentDay >= 1 && currentDay <= 9
      ? currentDay
      : null,
    days: dates.map((date, i) => ({
      day: (i + 1) as (1|2|3|4|5|6|7|8|9),
      date,
      form: NAVADURGA_FORMS[i],
      color: colors[i],
    })),
    vijayadashami,
  };
}

/**
 * Return the upcoming Navratri window. If a window is currently in progress
 * (today is between Day 1 and Day 9 inclusive), returns it; otherwise returns
 * the next one (this calendar year if it hasn't started yet, else next year).
 */
export function nextNavratri(
  kind: NavratriKind,
  today: Date,
  opts?: NavratriOpts,
): NavratriWindow | null {
  const year = today.getFullYear();
  const current = computeNavratriDates(kind, year, opts);
  if (current) {
    const todayStart = startOfLocalDay(today);
    // If currently active OR upcoming this year → return this.
    if (current.isActive || current.days[0].date.getTime() >= todayStart.getTime()) {
      return current;
    }
  }
  // Else look at next year.
  return computeNavratriDates(kind, year + 1, opts);
}

// ─── Ghatasthapana muhurat ───────────────────────────────────────────────────

/** Overlap helper — does [aStart, aEnd) intersect [bStart, bEnd)? */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Build a [start, end) range for a daily element (tithi/nakshatra/yoga) that's
 * active at a moment within the day. Uses `startTime` when present; falls
 * back to sunrise/nextSunrise bounds when the element straddles the boundary.
 */
function elementRange<T extends DailyTithiInfo | DailyNakshatraInfo | DailyYogaInfo>(
  el: T,
  sunrise: Date,
  nextSunrise: Date,
): [Date, Date] | null {
  const start = el.startTime ?? sunrise;
  const end = el.endTime ?? nextSunrise;
  if (start.getTime() >= end.getTime()) return null;
  return [start, end];
}

/**
 * Compute the Ghatasthapana muhurat window on a given date.
 *
 * Classical rule:
 *   1. The auspicious window is the **first one-third of the day**
 *      (sunrise → sunrise + dayDuration/3), **while Pratipada prevails**.
 *   2. Not within Amavasya, not at night/afternoon.
 *   3. If Pratipada has already ended by sunrise (rare — Pratipada kshaya),
 *      use **Abhijit muhurta** as the fallback.
 *   4. Chitra nakshatra (index 13) and Vaidhriti yoga (index 26) during the
 *      window are advised against — surfaced as warnings.
 */
export function computeGhatasthapanaMuhurat(
  date: Date,
  opts?: NavratriOpts,
): GhatasthapanaMuhurat | null {
  const { coords, timezone, ayanamsa } = resolveOpts(opts);
  let raw: DailyPanchangResult | null;
  try {
    raw = getDailyPanchang(
      date,
      { latitude: coords.lat, longitude: coords.lon },
      { timezone, computeEndTimes: true, ayanamsa },
    );
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[navratri]', e.code, e.message);
    } else {
      console.warn('[navratri] getDailyPanchang unexpected:', e);
    }
    return null;
  }
  if (!raw) return null;
  // Defensive: any thrown error below this point would crash the festivals
  // screen render. Wrap the whole computation in a try/catch.
  try {
    return computeGhatasthapanaMuhuratUnsafe(raw);
  } catch (e) {
    console.warn('[navratri] computeGhatasthapanaMuhurat failed:', e);
    return null;
  }
}

function computeGhatasthapanaMuhuratUnsafe(raw: DailyPanchangResult): GhatasthapanaMuhurat {

  const sunrise = raw.sunrise;
  const sunset = raw.sunset;
  const nextSunrise = raw.nextSunrise;
  const dayDurMs = sunset.getTime() - sunrise.getTime();
  const firstThirdEnd = new Date(sunrise.getTime() + dayDurMs / 3);

  // Pratipada is tithi number 1 (Shukla Pratipada).
  const pratipada = raw.tithis.find(t => t.number === 1);
  const pratipadaEnd = pratipada?.endTime ?? null;
  const isPratipadaActiveAtSunrise = raw.tithis[0]?.number === 1;

  // Window candidate: [sunrise, min(firstThirdEnd, pratipadaEnd)]
  let start = sunrise;
  let end = firstThirdEnd;
  let isAbhijitFallback = false;
  if (pratipadaEnd && pratipadaEnd.getTime() < end.getTime()) {
    end = pratipadaEnd;
  }

  // Fallback to Abhijit when Pratipada isn't active at sunrise.
  if (!isPratipadaActiveAtSunrise) {
    if (raw.abhijitMuhurta) {
      start = raw.abhijitMuhurta.start;
      end = raw.abhijitMuhurta.end;
      isAbhijitFallback = true;
    }
  }

  // Warnings — Chitra nakshatra (index 13) / Vaidhriti yoga (index 26) over
  // the muhurat window.
  let chitra = false;
  for (const n of raw.nakshatras) {
    if (n.index !== 13) continue;
    const r = elementRange(n, sunrise, nextSunrise);
    if (r && overlaps(r[0], r[1], start, end)) {
      chitra = true;
      break;
    }
  }
  let vaidhriti = false;
  for (const y of raw.yogas) {
    if (y.index !== 26) continue;
    const r = elementRange(y, sunrise, nextSunrise);
    if (r && overlaps(r[0], r[1], start, end)) {
      vaidhriti = true;
      break;
    }
  }

  return {
    start, end,
    isAbhijitFallback,
    sunrise, sunset,
    pratipadaEnd,
    warnings: { chitra, vaidhriti },
  };
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** Format a time as "HH:MM AM/PM" in the local timezone. */
export function formatMuhuratTime(d: Date): string {
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : (hours24 > 12 ? hours24 - 12 : hours24);
  return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** Format a date range like "5:42 AM – 7:02 AM". */
export function formatMuhuratRange(start: Date, end: Date): string {
  return `${formatMuhuratTime(start)} – ${formatMuhuratTime(end)}`;
}

/** Format a date as "Tue, 16 Oct" — for the day card. */
export function formatNavratriDayLabel(date: Date, lang: 'en' | 'hi'): string {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** ymd helper — exposed for notification id construction. */
export function navratriDayYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
