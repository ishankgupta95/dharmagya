/**
 * Navratri — date + colour + Ghatasthapana muhurat computation (Phase 14.3).
 *
 * Day-1 dates come from `@/data/festivals` — the app's festival catalogue,
 * decoded from the pre-generated `src/data/static/festivals-table.json` that
 * `npm run generate:festivals` builds out of panchang-ts's own
 * `buildFestivalsTable`. `Sharad Navaratri` for Sharad, `Ugadi` / `Gudi Padwa`
 * for Chaitra — both names sit on Chaitra Shukla Pratipada, which *is* Day 1.
 * Days 2..9 are simple `+N days` arithmetic. The only panchang-ts *compute*
 * left in this file is the **one** `getDailyPanchang` we need for the
 * Ghatasthapana muhurat window + Chitra/Vaidhriti caption flags on Day 1
 * (`formatInZone` is the library's pure ISO formatter, not a computation).
 *
 * **Why no `convertHinduToGregorian` here:** the earlier draft of this service
 * computed each Day-N date via panchang-ts tithi-by-tithi (~18 sync calls,
 * ~1–2 s on the JS thread). That was wasted work — the same dates are already
 * baked into the festival table. The lookup version below is O(days-in-year) and
 * runs in under a millisecond.
 */

import {
  formatInZone,
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
import { FALLBACK_COORDS, panchangTimezoneMinutes, type PanchangCoords } from './panchangService';
import festivalsData from '@/data/festivals';

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
  /** Window start — `max(sunrise, pratipadaStart)`. A true instant; schedule
   *  against `.getTime()`, never render with `.getHours()` (see `startLocal`). */
  start: Date;
  /** Window end — `min(firstThirdOfDay, pratipadaEnd)`. Same: instant, not a
   *  wall clock. */
  end: Date;
  /**
   * `start` / `end` rendered in the **place's** offset — offset-carrying ISO
   * 8601 ("2026-10-11T05:54:20.257+05:30"), the shape panchang-ts publishes as
   * its `*Local` companions.
   *
   * The window is computed in the timezone of `coords` (see `resolveOpts`), so
   * it has to be *displayed* there too. A bare `Date` carries no zone, so
   * `formatMuhuratTime` reads these strings; feeding it `start`/`end` and
   * calling `getHours()` would print the phone's wall clock instead — under
   * `TZ=America/New_York` that turned Varanasi's 5:54 AM Sharad-2026 window
   * into "8:24 PM".
   */
  startLocal: string;
  endLocal: string;
  /**
   * True when Shukla Pratipada does not overlap the first third of the day at
   * all, so the classical fallback to Abhijit muhurta applies. `start`/`end`
   * then reflect Abhijit's window. In practice this is the Pratipada-kshaya
   * case (Pratipada already over by sunrise); a Pratipada that merely starts
   * late still yields a rule-1 window and does not land here.
   * (Abhijit is itself `null` on Wednesdays per Smarta convention. No
   * permissible window remains in that case, so `computeGhatasthapanaMuhurat`
   * returns `null` rather than a record with this flag false — the sunrise
   * window is precisely what rule 1 disallows once Pratipada has gone.)
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
// Day-1 dates come from the pre-generated festival table (`@/data/festivals`
// over `src/data/static/festivals-table.json`). Days 2..9 are simple `+N days`
// arithmetic — a deliberate simplification: in a kshaya/vriddhi year the nine
// tithis do not land on nine distinct civil days, so Day 9 can sit a day off
// the table's own Rama Navami. Day 1 is the load-bearing one (Ghatasthapana,
// the active badge, the colour cycle) and is exact. Sharad's Day 10 comes from
// the same table ("Dussehra"). No panchang-ts calls for dates.

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
 *   - **chaitra** → "Ugadi" (or "Gudi Padwa" — the table carries both names on
 *     the same date), which is Chaitra Shukla Pratipada, i.e. Day 1 itself.
 *   - **magha-gupt / ashadha-gupt** → not in the festival table; returns null
 *     (the UI shows these as info-card-only, with no per-day dates).
 */
function day1ForKind(kind: NavratriKind, year: number): Date | null {
  switch (kind) {
    case 'sharad':
      return festivalDateInYear(year, 'Sharad Navaratri');
    case 'chaitra':
      // Read Pratipada straight off the table, exactly as `sharad` does above.
      // This used to derive Day 1 as `Rama Navami − 8 days`, which silently
      // assumed nine tithis always span nine civil days. A tithi runs
      // ~23.6–26.1 h, so one is regularly skipped (kshaya) or repeated
      // (vriddhi) inside that span, and the arithmetic was wrong in 5 of the 8
      // shipped years — in BOTH directions, so no constant offset fixes it.
      // Worst case it put Day 1 (and therefore Ghatasthapana) on Amavasya or
      // Krishna Chaturdashi, i.e. in the previous paksha entirely.
      return festivalDateInYear(year, 'Ugadi') ?? festivalDateInYear(year, 'Gudi Padwa');
    case 'magha-gupt':
    case 'ashadha-gupt':
      return null;
  }
}

export interface NavratriOpts {
  /** Defaults to `FALLBACK_COORDS` (Ujjain). Used only by Ghatasthapana muhurat. */
  coords?: PanchangCoords;
  /** Defaults to the offset of `coords` on the day being computed. Used only by
   *  Ghatasthapana muhurat. */
  timezone?: number;
  /** Defaults to `'lahiri'`. Used only by Ghatasthapana muhurat. */
  ayanamsa?: AyanamsaType;
  /** Defaults to `'purnimanta'`. Currently unused; kept for API compat. */
  masaSystem?: MasaSystem;
}

function resolveOpts(opts: NavratriOpts | undefined, date: Date) {
  const coords = opts?.coords ?? FALLBACK_COORDS;
  return {
    coords,
    // Resolved for the place and the day, not off the phone's clock right now
    // — see `panchangTimezoneMinutes`. A Ghatasthapana window is quoted to the
    // minute and pushed as a T-30 reminder, so rendering Varanasi's sunrise on
    // a New York clock (or last summer's offset) is not a rounding error.
    timezone: opts?.timezone ?? panchangTimezoneMinutes(coords, date),
    ayanamsa: opts?.ayanamsa ?? ('lahiri' as AyanamsaType),
  };
}

/**
 * Compute the 9-day window for a given Navratri kind in a given Gregorian
 * year. Reads Day-1 from the festival table; Days 2..9 + Day 10 are derived.
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

  // Day 10. Only Sharad has a named one — Dussehra is Ashvina Shukla Dashami,
  // so reading that entry for a Chaitra window returned a date six months away
  // (the screen printed "Day 10 — 20 Oct 2026" under a Day 9 in March). Every
  // other kind gets the plain Day 9 + 1, and the caller is responsible for not
  // labelling it "Vijayadashami" (the aparahna refinement is a separate
  // concern either way).
  const dussehra = kind === 'sharad' ? festivalDateInYear(year, 'Dussehra') : null;
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
    // `isActive` deliberately spans Day 1..9 only — it drives the "Day N"
    // badge, and there is no Day 10 form/colour to name. Vijayadashami can
    // fall a civil day (or two, in a kshaya year) after Day 9, so it needs its
    // own test: without it, on Dussehra morning this rolled to *next year's*
    // window, whose every date is past the reminder horizon — so the scheduler
    // wiped the navratri namespace and destroyed the Day-10 push hours before
    // it was due to fire.
    if (
      current.isActive ||
      current.days[0].date.getTime() >= todayStart.getTime() ||
      todayStart.getTime() <= current.vijayadashami.getTime()
    ) {
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
 *   3. If rule 1's window is empty — Pratipada does not overlap the first third
 *      of the day at all (in practice: Pratipada kshaya, already ended by
 *      sunrise) — use **Abhijit muhurta** as the fallback. When Abhijit is
 *      itself unavailable (panchang-ts returns `null` on Wednesdays), no
 *      permissible window remains and this returns `null` — we publish no
 *      muhurat rather than one rule 1 forbids.
 *   4. Chitra nakshatra (index 13) and Vaidhriti yoga (index 26) during the
 *      window are advised against — surfaced as warnings.
 */
export function computeGhatasthapanaMuhurat(
  date: Date,
  opts?: NavratriOpts,
): GhatasthapanaMuhurat | null {
  const { coords, timezone, ayanamsa } = resolveOpts(opts, date);
  // `date` is a device-local midnight (the festival table's civil date, via
  // `startOfLocalDay`), but panchang-ts reads the instant we hand it in
  // `timezone` to pick the Hindu day. Midnight in Auckland is still the
  // previous afternoon in Varanasi, so passing it straight through published
  // Day 0's muhurat — 2026-10-11 resolved to the 10th, where Pratipada has not
  // opened and the window fell through to Abhijit. Re-anchor to *noon of the
  // same calendar date in the place's own zone*, which lands mid-day for every
  // device offset.
  const at = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - timezone * 60_000,
  );
  let raw: DailyPanchangResult | null;
  try {
    raw = getDailyPanchang(
      at,
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

function computeGhatasthapanaMuhuratUnsafe(raw: DailyPanchangResult): GhatasthapanaMuhurat | null {

  const sunrise = raw.sun.rise;
  const sunset = raw.sun.set;
  const nextSunrise = raw.sun.nextRise;
  const dayDurMs = sunset.getTime() - sunrise.getTime();
  const firstThirdEnd = new Date(sunrise.getTime() + dayDurMs / 3);

  // Shukla Pratipada is absolute tithi index 0. `number` is 1..15 *within the
  // paksha*, so Krishna Pratipada also satisfies `number === 1` — index is the
  // only unambiguous test.
  const pratipada = raw.angas.tithis.find(t => t.index === 0);
  const pratipadaEnd = pratipada?.endTime ?? null;

  // Rule 1's window is the intersection of Shukla Pratipada with the first
  // third of the day. A tithi already running at sunrise carries a `startTime`
  // on the previous civil day, so the max() collapses to sunrise in the
  // ordinary case; when Pratipada instead *begins* after sunrise (the day opens
  // on Amavasya) it correctly clips the start forward.
  let start = sunrise;
  let end = firstThirdEnd;
  let isAbhijitFallback = false;
  if (pratipada) {
    const pratipadaStart = pratipada.startTime ?? sunrise;
    start = new Date(Math.max(sunrise.getTime(), pratipadaStart.getTime()));
    end = new Date(Math.min(firstThirdEnd.getTime(), (pratipadaEnd ?? firstThirdEnd).getTime()));
  }

  // Rule 3 — Abhijit is the fallback only when rule 1's window is *empty*.
  // The old test was "Pratipada is not the tithi at sunrise", which is also
  // true when Pratipada has simply not begun yet; in that case rule 1 still
  // has a valid overlap and the fallback fired over a perfectly good window.
  // (Sharad 2027-09-30: Amavasya holds sunrise and Pratipada runs 08:06 →
  // next dawn, so the classical window is 08:06–09:48; the old branch
  // published Abhijit, 11:24–12:11.) When the library has no Abhijit either —
  // it publishes `null` on Wednesdays — there is no permissible window and we
  // return none rather than one rule 1 forbids.
  if (!pratipada || start.getTime() >= end.getTime()) {
    if (!raw.muhurtas.abhijit) return null;
    start = raw.muhurtas.abhijit.start;
    end = raw.muhurtas.abhijit.end;
    isAbhijitFallback = true;
  }

  // Warnings — Chitra nakshatra (index 13) / Vaidhriti yoga (index 26) over
  // the muhurat window.
  let chitra = false;
  for (const n of raw.angas.nakshatras) {
    if (n.index !== 13) continue;
    const r = elementRange(n, sunrise, nextSunrise);
    if (r && overlaps(r[0], r[1], start, end)) {
      chitra = true;
      break;
    }
  }
  let vaidhriti = false;
  for (const y of raw.angas.yogas) {
    if (y.index !== 26) continue;
    const r = elementRange(y, sunrise, nextSunrise);
    if (r && overlaps(r[0], r[1], start, end)) {
      vaidhriti = true;
      break;
    }
  }

  // Display companions, rendered in the offset the window was computed in.
  // `start`/`end` are frequently *derived* (clipped against the first third of
  // the day, or Pratipada's end), so there is no library-published `*Local` to
  // reuse for them — `formatInZone` is the sanctioned way to localize an
  // instant we produced ourselves.
  const offsetMinutes = raw.timezone.offsetMinutes;

  return {
    start, end,
    startLocal: formatInZone(start, offsetMinutes),
    endLocal: formatInZone(end, offsetMinutes),
    isAbhijitFallback,
    sunrise, sunset,
    pratipadaEnd,
    warnings: { chitra, vaidhriti },
  };
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

/**
 * Format one of `GhatasthapanaMuhurat`'s `*Local` strings — offset-carrying ISO
 * 8601, "2026-10-11T05:54:20.257+05:30" — as "H:MM AM/PM".
 *
 * Takes the localized string, not the `Date`, because panchang-ts v5 publishes
 * true instants and a `Date` carries no zone: `d.getHours()` renders the
 * *phone's* wall clock, while the muhurat is computed in the *place's* (see
 * `resolveOpts`). Splitting the two printed Varanasi's 5:54 AM Sharad-2026
 * window as "8:24 PM" on a New York device. Slicing a fixed-width local ISO is
 * the same approach `formatLocal` takes in `panchangService`.
 */
export function formatMuhuratTime(local: string): string {
  const hours24 = Number(local.slice(11, 13));
  if (!Number.isFinite(hours24)) return '';
  const minutes = local.slice(14, 16);
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${meridiem}`;
}

/** Format a range like "5:42 AM – 7:02 AM" from a muhurat's `startLocal` /
 *  `endLocal` (never its `start` / `end` — those are zone-less instants). */
export function formatMuhuratRange(startLocal: string, endLocal: string): string {
  return `${formatMuhuratTime(startLocal)} – ${formatMuhuratTime(endLocal)}`;
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
