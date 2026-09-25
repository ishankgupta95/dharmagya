import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from 'expo-sqlite/kv-store';
import i18n from '@/i18n';
import { localizeFestivalName } from '@/i18n/festivalNames';
import {
  useStore,
  type ReminderPrefs,
  type TithiReminderKey,
  type FestivalReminderKey,
  type MasaSystem,
  type Region,
} from '@/store/useStore';
import festivalsData, {
  festivalDaysForYear,
  festivalsForDay,
  FESTIVALS_MIN_YEAR,
  FESTIVALS_MAX_YEAR,
} from '@/data/festivals';
import {
  moonPhaseDaysForYear,
  MOON_PHASES_MIN_YEAR,
  MOON_PHASES_MAX_YEAR,
} from '@/data/moonPhases';
import { HEADLINE_MAJORS, pickHeadlineMajor, pickHeadlineName } from '@/utils/festivalHeadline';
import { applyQuietHoursShift } from '@/utils/format';
import {
  cancelIds,
  IOS_REMINDER_BUDGET,
  requestNotificationPermission,
  staleIdsFor,
  type QuietHours,
  type SchedulePass,
} from './notifications';
import {
  computeGhatasthapanaMuhurat,
  formatMuhuratRange,
  formatMuhuratTime,
  nextNavratri,
  navratriDayYmd,
  type NavratriDay,
  type NavratriWindow,
} from './astrology/navratri';
import { NAVADURGA_FORMS } from '@/config/navratri';

// ─── Setup ────────────────────────────────────────────────────────────────────

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    // A deferred `require`, not a static import, on purpose: the native module
    // is absent in Expo Go, and a top-level import would throw while the bundle
    // evaluates — before the `isExpoGo` guard above could run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  } catch {
    // native module unavailable
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TITHI_PREFIX = 'dharmagya-tithi-';
const FESTIVAL_PREFIX = 'dharmagya-festival-';
const NAVRATRI_PREFIX = 'dharmagya-navratri-';
/** Look this many days ahead when scheduling. */
const HORIZON_DAYS = 30;
/**
 * The calendar years the two pre-generated tables this scheduler reads actually
 * cover, as a UNION. `enumerateReminders` clamps its year walk to this so a
 * wide horizon iterates years that exist instead of empty map lookups.
 *
 * Both tables are emitted by the same generator run and today cover the same
 * span, but they are separate artifacts with separate `_meta` ranges — taking
 * the union means neither source can be silently truncated by the other's
 * range if they ever diverge. Outside the range both readers already return
 * empty, so a too-wide bound costs a no-op iteration, never a wrong answer.
 */
const DATA_MIN_YEAR = Math.min(FESTIVALS_MIN_YEAR, MOON_PHASES_MIN_YEAR);
const DATA_MAX_YEAR = Math.max(FESTIVALS_MAX_YEAR, MOON_PHASES_MAX_YEAR);
/** HH:mm — when each Navratri day's morning push fires. Same time every day. */
const NAVRATRI_MORNING_TIME = '08:00';
/** Default tithi reminder time on the evening BEFORE the observance. */
const DEFAULT_TITHI_TIME = '19:00';
/** Default festival reminder time on the evening BEFORE. */
const DEFAULT_FESTIVAL_TIME = '20:00';
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Days of slack on each side of the horizon when enumerating CANDIDATES for the
 * dedupe pass. That pass compares an entry with its neighbours up to two days
 * away (a festival anchored the day before its tithi, a row the table repeats
 * on the next day), so those neighbours have to be in the list even when their
 * own push falls outside [now, cutoff]. Without the slack, which of two pushes
 * for the same observance survived depended on WHEN the app was last opened:
 * the first push fires, the next open no longer enumerates it, and its
 * duplicate is then scheduled after all. Only the final filter applies the
 * horizon.
 */
const DEDUPE_SLACK_DAYS = 3;
/**
 * Longest run of consecutive days one observance is walked back through (see
 * `observanceOf`). No key in the shipped 2020–2050 table runs past two days;
 * the bound only keeps a malformed table from walking a whole year. Tied to
 * the slack: the first day of a longer run could fall outside the candidate
 * window its later days are deduped against.
 */
const MAX_OBSERVANCE_RUN_DAYS = DEDUPE_SLACK_DAYS + 1;
/** Observance-id namespace for the moon-phase entries, which have no table row. */
const MOON_PHASE_OBSERVANCE = 'moon-phase:';
/**
 * kv-store key of the delivery ledger: identifier → the instant (ms, after any
 * quiet-hours shift) at which the OS was last left holding that push. See
 * `deliveredIdsFrom`.
 */
const DELIVERY_LEDGER_KEY = 'dharmagya-reminder-ledger';
/**
 * How long a push that already fired is remembered. The dedupe pass reaches
 * back DEDUPE_SLACK_DAYS before today plus an evening-before; a day of margin
 * on top, and anything older can no longer be anyone's partner.
 */
const DELIVERY_LEDGER_KEEP_MS = (DEDUPE_SLACK_DAYS + 2) * DAY_MS;

function parseHHmm(timeHHmm: string, fallbackHour: number): { hour: number; minute: number } {
  const [h, m] = timeHHmm.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) && h >= 0 && h < 24 ? h : fallbackHour,
    minute: Number.isFinite(m) && m >= 0 && m < 60 ? m : 0,
  };
}

// ─── Festival name matching for tithi reminders ───────────────────────────────
// Maps a TithiReminderKey to a predicate over a festival entry. We use the
// app's festival catalogue (`@/data/festivals`, decoded from the pre-generated
// `src/data/static/festivals-table.json`) as our source of tithi observance
// dates — panchang-ts computed them when the table was generated, so we don't
// recompute per-device.

// `key` is the stable, language-independent festival id — the thing
// `festivalAllowedInRegion` matches on. Every row in the generated table
// carries one (verified across 2024–2031: 2099 rows, 0 without a key).
type FestivalEntry = { key: string; name: string; type: string; description?: string };

function isEkadashi(f: FestivalEntry): boolean {
  return (
    f.type === 'ekadashi' ||
    f.type === 'smarta_ekadashi' ||
    f.type === 'vaishnava_ekadashi'
  );
}

/**
 * Festival-table matchers for the tithi observances the table actually carries.
 *
 * `purnima` / `amavasya` are deliberately absent: the table ships no generic
 * monthly row for either — the only entries whose names contain those words are
 * named festivals (Guru Purnima, Kartika Purnima, Mahalaya Amavasya…) — so
 * name-matching gave those two toggles 4–5 and 2 hits a year against a setting
 * that promises ~12. They are sourced from `@/data/moonPhases` instead — and
 * the festival rows that ARE that Purnima / Amavasya are linked back to the
 * moon-phase entry through `MOON_PHASE_FESTIVAL`, so the dedupe pass still sees
 * the two as one event.
 */
const TITHI_MATCHES: Partial<Record<TithiReminderKey, (f: FestivalEntry) => boolean>> = {
  ekadashi: isEkadashi,
  pradosha: (f) => f.type === 'pradosha',
  sankashti: (f) => f.name.toLowerCase().includes('sankashti') || f.name.toLowerCase().includes('ganesh chaturthi'),
  shivaratri: (f) =>
    f.name.toLowerCase().includes('shivaratri') ||
    f.name.toLowerCase().includes('shivratri') ||
    // v2 emits "Masik Shivaratri" for monthly observance
    f.name.toLowerCase().includes('masik shivaratri'),
};

/**
 * Which Ekadashi row gets to name the reminder when no classical name is
 * available, most-preferred first.
 *
 * The reminder is normally named after the CLASSICAL Ekadashi ("Saphala
 * Ekadashi"), which the table carries in `description` and `pickHeadlineName`
 * extracts — that is what the calendar cell and the festival-category push
 * both say, so it is what this reminder says too. A sect label is only the
 * fallback, for the viddha/vriddha dates where `description` is an explanatory
 * sentence rather than a name (10 of the 224 Ekadashi dates in 2024–2031).
 *
 * On those dates the table lists its rows `vaishnava_ekadashi`,
 * `smarta_ekadashi`, `ekadashi`, so simply taking the first match would
 * announce the Vaishnava fast. That is a choice, not a default, so make it
 * deliberately: the app already prefers the Smarta row wherever it has to pick
 * one, in `calendarService.pickPrimaryEvent`. Vaishnava is next, for the dates
 * that carry only that row, and the generic row is last.
 */
const EKADASHI_TYPE_PREFERENCE = ['smarta_ekadashi', 'vaishnava_ekadashi', 'ekadashi'] as const;

/** The festival row a tithi reminder should be named after, out of every row on
 *  that date matching the toggle. Only Ekadashi has more than one candidate. */
function pickTithiFestival(key: TithiReminderKey, matches: FestivalEntry[]): FestivalEntry | undefined {
  if (key !== 'ekadashi') return matches[0];
  for (const type of EKADASHI_TYPE_PREFERENCE) {
    const hit = matches.find((f) => f.type === type);
    if (hit) return hit;
  }
  return matches[0];
}

/** The two tithi observances that come from the moon-phase table, not the
 *  festival table. Value is the phase key in `moonPhaseDaysForYear`. */
const MOON_PHASE_TITHI: Partial<Record<TithiReminderKey, 'full' | 'new'>> = {
  purnima: 'full',
  amavasya: 'new',
};

/**
 * Festival rows that ARE the day's Purnima / Amavasya — the festival is kept ON
 * that tithi, so announcing both is announcing one observance twice. The
 * moon-phase entry `covers` such a row (see `ScheduledReminder`) so the dedupe
 * pass (`dedupeReminders`) can collapse it against the festival-category push
 * for the same row. Before that link existed the user got "🌕 Purnima
 * tomorrow" at 19:00 AND "🪔 Guru Purnima" at 20:00.
 *
 * Two ways in, per phase, so a full-moon entry never claims an Amavasya row:
 *
 * - `name`: the row names the tithi — "Guru Purnima", "Sharad Purnima",
 *   "Kartika Purnima", "Vat Savitri (Purnima)", "Mahalaya Amavasya", "Vat
 *   Savitri (Amavasya)" are the six the shipped table carries. Word-bounded, so
 *   a row that merely contains the letters is not caught by accident.
 * - `keys`: the rows that are that tithi's festival WITHOUT naming it, by
 *   stable table key. Derived from the shipped 2020–2050 table — every annual
 *   row within a day of the same-phase sunrise moon day in at least 28 of its
 *   31 years (under panchang-ts 5.3, which left Holi and Diwali out of 2 and 3
 *   of them) — and then kept only where that tithi is the festival's
 *   definition: Phalguna Purnima (Holika Dahan since 5.4, and Himachal's
 *   Phagli beside it; Holi is now the NEXT day in most years and stays linked
 *   for the ones it still falls on the sunrise Purnima), Chaitra Purnima (Hanuman Jayanti,
 *   Bengaluru's Karaga), Shravana Purnima (Raksha Bandhan, Yajur Upakarma),
 *   Diwali's own Amavasya, and Mahalaya Amavasya (Telangana's Engili Pula,
 *   which opens Bathukamma on it). Left out on purpose: the Chaturdashi /
 *   Pratipada festivals either side of a moon day (Anant Chaturdashi, Narak
 *   Chaturdashi, Govardhan Puja, Ugadi / Gudi Padwa, Sharad Navaratri), which
 *   are other tithis, and Rig Upakarma, which follows the Shravana NAKSHATRA
 *   (on the Purnima in 13 years, within a day of it in 23). Before these were
 *   linked each of them reached the user twice — "🌕 Purnima tomorrow" at
 *   19:00 and "🪔 Raksha Bandhan" at 20:00 — and Diwali, on the years its
 *   pradosh anchoring puts it a day early, on two consecutive evenings.
 *
 * The link reaches ONE DAY either side of the moon-phase date, not just the
 * date itself. The moon-phase table is the SUNRISE tithi, but a festival can be
 * anchored to the tithi at another point of the day: Vat Savitri (Amavasya)
 * follows the Amavasya in the afternoon (aparahna) and Diwali's Lakshmi Puja
 * follows it at dusk (pradosh), so each lands the day BEFORE the sunrise
 * Amavasya in some years (Vat Savitri 9 of the table's 31, Diwali 15, plus
 * 2050 when it spans both days) — and a same-date link let the festival and
 * "🌑 Amavasya tomorrow" fire on two consecutive evenings for the one
 * Amavasya. A festival can also sit on the day AFTER the sunrise moon day:
 * Holi, which since panchang-ts 5.4 is the day after Holika Dahan, and Phagli,
 * which keeps every day whose sunrise holds Purnima (2033-03-15/16,
 * 2034-03-04/05). A new or full moon is ~29.5 days from the next of its
 * kind, so a one-day reach can never claim another month's row.
 */
const MOON_PHASE_FESTIVAL: Record<'full' | 'new', { name: RegExp; keys: ReadonlySet<string> }> = {
  full: {
    name: /\bpurnima\b/i,
    keys: new Set(['holika_dahan', 'holi', 'phagli', 'hanuman_jayanti', 'karaga', 'raksha_bandhan', 'yajur_upakarma']),
  },
  new: {
    name: /\bamavasya\b/i,
    keys: new Set(['diwali', 'bathukamma_start']),
  },
};

/** True when festival row `f` is kept on the `phase` moon day itself. */
function isMoonPhaseFestival(phase: 'full' | 'new', f: FestivalEntry): boolean {
  const link = MOON_PHASE_FESTIVAL[phase];
  return link.keys.has(f.key) || link.name.test(f.name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseObservanceDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

/** `YYYY-MM-DD` of a Date's local calendar day. */
function ymdOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Calendar arithmetic on a `YYYY-MM-DD` string, in whole local days. */
function shiftYmd(ymd: string, days: number): string {
  const d = parseObservanceDate(ymd);
  d.setDate(d.getDate() + days);
  return ymdOf(d);
}

function eveningBefore(observance: Date, hour: number, minute: number = 0): Date {
  const d = new Date(observance);
  d.setDate(d.getDate() - 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface ScheduledReminder {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  /**
   * Re-render the copy for the time the notification will actually fire.
   * Quiet hours can move an "evening before" reminder past midnight and onto
   * the observance day itself, at which point a frozen "…is tomorrow" title
   * asserts the wrong day for the fast it exists to announce. Callers that
   * bake a time-relative phrase into `title`/`body` supply this so
   * `rescheduleReminders` can re-derive after shifting.
   */
  render?: (fireAt: Date) => { title: string; body: string };
  /** When set, the reminder is pointless past this instant and is dropped if a
   *  quiet-hours shift pushes it there. */
  muhuratEnd?: Date;
  /**
   * Tithi reminders: the observance (`observanceOf`) of every festival row the
   * toggle's matcher covered on that date. An Ekadashi date carries up to three
   * rows and the reminder is named after only one of them
   * (`pickTithiFestival`), but it speaks for all three. On the moon-phase
   * entries: the entry's own moon-phase observance, plus that of every
   * festival row that IS this Purnima / Amavasya (`MOON_PHASE_FESTIVAL`),
   * within a day either side. Absent on the Navratri entries, which come from
   * no festival row.
   */
  covers?: string[];
  /**
   * Moon-phase entries only: the observances in `covers` that belong to a named
   * festival anchored on ANOTHER day than this entry's own. This entry cannot
   * carry that festival's name (it would announce it for the wrong day), so a
   * festival push for one of them always wins over it — see `dedupeReminders`.
   */
  yieldsTo?: string[];
  /**
   * Festival-category reminders: the observance of the single row this
   * reminder is named after. When a tithi reminder already covers that
   * observance the two are the same event seen through two toggles — see
   * `dedupeReminders`.
   */
  announces?: string;
  /**
   * Festival-category reminders whose headline is a NAMED ANNUAL festival
   * (`HEADLINE_MAJORS`) rather than the recurring observance a tithi toggle is
   * named after. Those two are the same event, and this one's title is the
   * more specific of the pair, so it wins the dedupe (`dedupeReminders`).
   */
  outranksTithi?: boolean;
  /**
   * Festival-category reminders: this push named after the best of the rows in
   * its (category, date) group whose observance starts on this date and is not
   * `spokenFor`, or null when there is none. The dedupe pass calls it when the
   * headline row is already spoken for — the second day of that row's run, or
   * a row a tithi reminder announces — so a different festival that merely
   * shares the date and category still gets its push instead of being dropped
   * with it.
   */
  reHead?: (spokenFor: (observance: string) => boolean) => FestivalHeadline | null;
}

/** The part of a festival-category push that depends on which row it names. */
type FestivalHeadline = Required<
  Pick<ScheduledReminder, 'title' | 'body' | 'render' | 'announces' | 'outranksTithi'>
>;

/** Same civil day, ignoring time. */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Enumerate all reminders that SHOULD be scheduled given current prefs and today.
 * Returns a pure list (no side effects) so callers can diff against
 * currently-scheduled notifications and test logic easily.
 */
export interface ReminderTimes {
  /** HH:mm — evening before observance, when tithi reminders fire. */
  tithi?: string;
  /** HH:mm — evening before observance, when festival reminders fire. */
  festival?: string;
}

/**
 * Tithi reminder copy for a given fire time. The default wording is "…
 * tomorrow"; when quiet hours have pushed the notification onto the observance
 * day itself, say "today" instead of asserting the wrong day.
 */
function renderTithi(
  key: TithiReminderKey,
  label: string,
  observance: Date,
  fireAt: Date,
): { title: string; body: string } {
  const eveningTitle = i18n.t(`reminders.tithiTitle.${key}`, { defaultValue: label });
  const eveningBody = i18n.t('reminders.tithiBody', { name: label });
  if (!isSameLocalDay(fireAt, observance)) {
    return { title: eveningTitle, body: eveningBody };
  }
  // `defaultValue` so a not-yet-translated key degrades to the evening wording
  // rather than printing a raw key path into a push notification.
  return {
    title: i18n.t(`reminders.tithiTitleToday.${key}`, { defaultValue: eveningTitle }),
    body: i18n.t('reminders.tithiBodyToday', { name: label, defaultValue: eveningBody }),
  };
}

/** Festival reminder copy for a given fire time. See `renderTithi`. */
function renderFestival(
  name: string,
  observance: Date,
  fireAt: Date,
): { title: string; body: string } {
  const eveningBody = i18n.t('reminders.festivalBody', { name });
  return {
    title: i18n.t('reminders.festivalTitle', { name }),
    body: isSameLocalDay(fireAt, observance)
      ? i18n.t('reminders.festivalBodyToday', { name, defaultValue: eveningBody })
      : eveningBody,
  };
}

/**
 * @param delivered Identifiers of pushes that have already gone out (see
 *   `deliveredIdsFrom`). A candidate whose fire time is past only takes part
 *   in the dedupe when it is in this set: a push that never fired — its toggle
 *   was off, permission was not granted yet, the app was not installed — must
 *   not claim an observance and silence the one push that can still reach the
 *   user. Omitted, every past candidate is assumed to have fired, which is what
 *   a caller with no record of the queue (a preview, a test) can best assume.
 */
export function enumerateReminders(
  prefs: ReminderPrefs,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS,
  times: ReminderTimes = {},
  region: Region = 'all',
  delivered?: ReadonlySet<string>,
  masaSystem: MasaSystem = 'purnimanta',
): ScheduledReminder[] {
  const tithi = parseHHmm(times.tithi ?? DEFAULT_TITHI_TIME, 19);
  const festival = parseHHmm(times.festival ?? DEFAULT_FESTIVAL_TIME, 20);
  const candidates: ScheduledReminder[] = [];
  const nowMs = now.getTime();
  const cutoffMs = nowMs + horizonDays * DAY_MS;

  // Observance days that can matter: every day whose evening-before push can
  // land in [now, cutoff] (so up to one day past the cutoff), widened by
  // DEDUPE_SLACK_DAYS on each side for the dedupe pass below. Compared as
  // `YYYY-MM-DD` strings, which order the same as the dates they name.
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + horizonDays);
  const windowStart = shiftYmd(ymdOf(now), -DEDUPE_SLACK_DAYS);
  const windowEnd = shiftYmd(ymdOf(endDate), 1 + DEDUPE_SLACK_DAYS);
  const inWindow = (ymd: string): boolean => ymd >= windowStart && ymd <= windowEnd;

  // Walk through the window's festival data, year by year.
  //
  // The range is ITERATED, not sampled at its two endpoints. Adding only
  // `now`'s year and `endDate`'s year covered the common one- and two-year
  // cases but skipped every year strictly BETWEEN them, so any horizon wider
  // than about a year silently lost whole years of observances — fewer
  // reminders, never an error. Replayed against the shipped tables at
  // now = 2026-09-04 with every toggle on and region 'all', before → after:
  // horizon 500 days 77 → 288 pushes and 730 days 206 → 417 (2027 was skipped
  // outright), and 2921 days 70 → 1119. From that same date the two agree for
  // every horizon up to 483 days and first diverge at 484 — the point where a
  // third year appears — so nothing shipped was ever affected at
  // HORIZON_DAYS = 30. This is here so that widening it stays safe.
  //
  // Clamped to DATA_MIN_YEAR..DATA_MAX_YEAR so a wide horizon cannot walk off
  // the end of the tables.
  const firstYear = Math.max(Number(windowStart.slice(0, 4)), DATA_MIN_YEAR);
  const lastYear = Math.min(Number(windowEnd.slice(0, 4)), DATA_MAX_YEAR);
  const years: number[] = [];
  for (let year = firstYear; year <= lastYear; year++) years.push(year);

  type YearEntry = { date: string; festivals: FestivalEntry[] };
  const data = festivalsData as Record<string, YearEntry[] | undefined>;

  // ── Region-scoped rows by date ───────────────────────────────────────────
  // The table is built at `region: 'all'`, so it carries every regional
  // variant and the user's Region is applied at read time. The browse
  // screens deliberately stay unfiltered — scrolling past Bonalu costs
  // nothing — but a push is intrusive, and unfiltered it sends a Punjab
  // user Bonalu / Bathukamma / Pongal and a Tamil Nadu user Lohri / Gudi
  // Padwa / the Teejs. Measured over 2024–2031 with every toggle on, this
  // removes at most ~15 pushes a year for a single region and never
  // removes a tithi reminder: none of the rows the tithi matchers hit are
  // region-scoped. Default 'all' filters nothing.
  //
  // `festivalsForDay` also applies the per-(region, masa) corrections, so an
  // Amanta or Nepal user is reminded of their own Shravan Mondays and a user
  // outside Tamil Nadu still gets the Masik Karthigai on Karthigai Deepam's day.
  //
  // Any date, not just the window's: `observanceOf` walks back past its
  // start, and a Jan 1 run reaches into the previous year. Indexed per year
  // and filtered per date, both on first use, so a call touches only the
  // (usually one or two) years it reads.
  const dayIndex = new Map<string, Map<string, FestivalEntry[]>>();
  const filtered = new Map<string, FestivalEntry[]>();
  const rowsOn = (ymd: string): FestivalEntry[] => {
    const hit = filtered.get(ymd);
    if (hit) return hit;
    const yearKey = ymd.slice(0, 4);
    let index = dayIndex.get(yearKey);
    if (!index) {
      index = new Map();
      for (const day of data[yearKey] ?? []) index.set(day.date, day.festivals);
      dayIndex.set(yearKey, index);
    }
    const rows = [...festivalsForDay(ymd, index.get(ymd) ?? [], region, masaSystem)];
    filtered.set(ymd, rows);
    return rows;
  };

  // ── Observance identity ──────────────────────────────────────────────────
  // What the dedupe pass compares: one OBSERVANCE, not one calendar date. The
  // table can carry the same row — same stable `key` — on two consecutive
  // days. Under panchang-ts 5.3 that was common: Masik Karthigai (Krittika
  // standing over two sunrises) several times a year, Pradosha / Masik
  // Shivaratri / Vinayaka Chaturthi a few times, Durga Ashtami 2027, Jagannath
  // Rath Yatra 2030, Vat Savitri (Purnima) 2027. 5.4 picks one day for every
  // festival but Phagli, which still takes each day whose sunrise holds
  // Purnima (2033-03-15/16, 2034-03-04/05), and the rule is kept because the
  // next engine may reintroduce a run. A date-keyed identity announced each of
  // them on two evenings running. So a row's observance is its key plus the
  // FIRST day of its run of consecutive days: both days of a run name the same
  // observance.
  //
  // Keyed by `key`, so rows with DIFFERENT keys on neighbouring days stay
  // separate observances. That is deliberate for the Smarta / Vaishnava
  // Ekadashi split (`smarta_ekadashi` one day, `vaishnava_ekadashi` the next):
  // those are two sects' fast days, and a Vaishnava relying on the push must
  // not be told only the Smarta date — fasting on the Dashami-viddha day is
  // exactly what the later date exists to avoid.
  const runStart = new Map<string, string>();
  const observanceOf = (ymd: string, f: FestivalEntry): string => {
    const memoKey = `${f.key}|${ymd}`;
    let start = runStart.get(memoKey);
    if (start === undefined) {
      start = ymd;
      for (let i = 1; i < MAX_OBSERVANCE_RUN_DAYS; i++) {
        const prev = shiftYmd(start, -1);
        if (!rowsOn(prev).some((g) => g.key === f.key)) break;
        start = prev;
      }
      runStart.set(memoKey, start);
    }
    return `${f.key}@${start}`;
  };

  for (const year of years) {
    // ── Purnima / Amavasya ────────────────────────────────────────────────
    // Sourced from the moon-phase table, not from festival names — see
    // MOON_PHASE_TITHI. The moon-phase table has its own range (see
    // DATA_MIN_YEAR), so this runs even for a year the festival table lacks.
    for (const key of Object.keys(MOON_PHASE_TITHI) as TithiReminderKey[]) {
      if (!prefs.tithi[key]) continue;
      const phase = MOON_PHASE_TITHI[key];
      if (!phase) continue;
      for (const ymdStr of moonPhaseDaysForYear(year, phase)) {
        if (!inWindow(ymdStr)) continue;
        const observance = parseObservanceDate(ymdStr);
        const fireAt = eveningBefore(observance, tithi.hour, tithi.minute);
        // The festival rows that ARE this Purnima / Amavasya
        // (`MOON_PHASE_FESTIVAL`), a day either side, region-scoped exactly as
        // the festival pass below is, so the link only ever points at a push
        // that pass can actually emit. A row whose observance starts on THIS
        // date is this entry under its proper name; one that starts on a
        // neighbouring day is the same tithi anchored elsewhere, which this
        // entry yields to (`yieldsTo`).
        const covers = new Set<string>([`${MOON_PHASE_OBSERVANCE}${phase}@${ymdStr}`]);
        const yieldsTo = new Set<string>();
        const sameDay: FestivalEntry[] = [];
        for (const offset of [-1, 0, 1]) {
          const date = shiftYmd(ymdStr, offset);
          for (const f of rowsOn(date)) {
            if (!isMoonPhaseFestival(phase, f)) continue;
            const obs = observanceOf(date, f);
            covers.add(obs);
            if (!obs.endsWith(`@${ymdStr}`)) yieldsTo.add(obs);
            else if (offset === 0) sameDay.push(f);
          }
        }
        // Owner decision (festivals are a MAJOR TITLE): when this Purnima /
        // Amavasya is a festival, the push is titled with that festival —
        // "🪔 Guru Purnima", "🪔 Raksha Bandhan", not "🌕 Purnima tomorrow" —
        // whichever toggle it comes through. With the festival toggle also on,
        // the festival push usually wins the dedupe outright (the majors are
        // in HEADLINE_MAJORS), and this copy is what still says so when only
        // the Purnima / Amavasya toggle is on, or when the festival is a
        // `minor` one (Kartika Purnima). The body stays the tithi's own line
        // ("Purnima is tomorrow — prepare your observance."): that is what
        // this toggle promised, and "Raksha Bandhan" alone does not say it.
        // A day can carry more than one linked row (Holi + Phagli, Raksha
        // Bandhan + Yajur Upakarma): a major beats a minor, then the
        // HEADLINE_MAJORS ranking, as on the calendar cell. Same English →
        // UI-language boundary as the festival pass.
        const sameDayMajors = sameDay.filter((f) => f.type === 'major');
        const named =
          sameDayMajors.length > 0
            ? pickHeadlineMajor(sameDayMajors)
            : sameDay.length > 0
              ? pickHeadlineMajor(sameDay)
              : undefined;
        const label = i18n.t(`reminders.tithiLabel.${key}`, { defaultValue: key });
        let render: (at: Date) => { title: string; body: string };
        if (named) {
          const festivalName = localizeFestivalName(named.name, i18n.language);
          render = (at) => ({
            title: renderFestival(festivalName, observance, at).title,
            body: renderTithi(key, label, observance, at).body,
          });
        } else {
          render = (at) => renderTithi(key, label, observance, at);
        }
        candidates.push({
          id: `${TITHI_PREFIX}${key}-${ymdStr}`,
          fireAt,
          ...render(fireAt),
          render,
          covers: [...covers],
          yieldsTo: [...yieldsTo],
        });
      }
    }

    // The corrected view, not the raw table: a Region / month-system correction
    // can put an observance on a day the table has no row for (an Amanta
    // Shravan Monday), and walking the table's own dates never reaches it.
    // `rowsOn` then reads the same corrected rows for each date. `[]` for a
    // year outside the table, as the raw lookup was.
    for (const day of festivalDaysForYear(year, region, masaSystem)) {
      if (!inWindow(day.date)) continue;
      const observance = parseObservanceDate(day.date);
      const festivals = rowsOn(day.date);
      if (festivals.length === 0) continue;

      // ── Tithi reminders ──────────────────────────────────────────────────
      // One per (key, date): several festivals on one day can match the same
      // key, and they all shared an identifier, so only the last survived —
      // under an arbitrary one of their names. Which of the matching rows now
      // names the reminder is `pickTithiFestival`'s decision, not the table's
      // emission order.
      for (const key of Object.keys(prefs.tithi) as TithiReminderKey[]) {
        if (!prefs.tithi[key]) continue;
        const match = TITHI_MATCHES[key];
        if (!match) continue;
        const matched = festivals.filter(match);
        const hit = pickTithiFestival(key, matched);
        if (!hit) continue;
        const fireAt = eveningBefore(observance, tithi.hour, tithi.minute);
        // Ekadashi: name the reminder after the CLASSICAL Ekadashi, which the
        // table carries in `description` and `pickHeadlineName` extracts. The
        // calendar cell and the festival-category push below both say that
        // name; a tithi push saying "Smarta Ekadashi" instead made three
        // surfaces give two answers for the same date. `pickHeadlineName`
        // falls back to a ROW's own name when no classical name is available,
        // and that fallback is whichever row is first in the table (Vaishnava
        // on 198 of 224 dates) — so when it lands there, defer to
        // `pickTithiFestival`'s Smarta preference instead.
        const headline = key === 'ekadashi' ? pickHeadlineName('ekadashi', matched) : '';
        const rawName =
          headline && !matched.some((f) => f.name === headline) ? headline : hit.name;
        // The festival table is decoded in English (see `src/data/festivals.ts`
        // for why). Push notifications interpolate names into a localized
        // template, so translate at the boundary.
        const label = localizeFestivalName(rawName, i18n.language);
        candidates.push({
          id: `${TITHI_PREFIX}${key}-${day.date}`,
          fireAt,
          ...renderTithi(key, label, observance, fireAt),
          render: (at) => renderTithi(key, label, observance, at),
          covers: [...new Set(matched.map((f) => observanceOf(day.date, f)))],
        });
      }

      // ── Festival-category reminders ──────────────────────────────────────
      // Normalize v2 subtypes (smarta_ekadashi, vaishnava_ekadashi) into the
      // single user-facing 'ekadashi' bucket. 'eclipse' is always notified
      // under 'major' (can't turn off — rare and high-signal).
      //
      // Group by category first and announce ONE name per (category, date).
      // Emitting one entry per festival gave them all the same identifier, and
      // expo-notifications is identifier-keyed, so whichever was written last
      // won — announcing Dussehra as "Bathukamma: Saddula" and Ganesh
      // Chaturthi as "Hartalika Teej". `pickHeadlineName` applies the same
      // recognition ranking the calendar cell uses.
      const byCategory = new Map<FestivalReminderKey, FestivalEntry[]>();
      for (const f of festivals) {
        const festivalKey: FestivalReminderKey | null =
          f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
            ? 'ekadashi'
            : f.type === 'eclipse'
              ? 'major'
              : (f.type as FestivalReminderKey);
        if (!festivalKey || !prefs.festival[festivalKey]) continue;
        const arr = byCategory.get(festivalKey);
        if (arr) arr.push(f);
        else byCategory.set(festivalKey, [f]);
      }
      for (const [festivalKey, group] of byCategory) {
        const fireAt = eveningBefore(observance, festival.hour, festival.minute);
        const members = group.map((f) => ({ row: f, observance: observanceOf(day.date, f) }));
        // `pickHeadlineName` returns a string — usually a row's `name`, but for
        // Ekadashi the classical name the row carries in `description`. Map it
        // back to the row it came from: the dedupe pass below compares
        // observances, not rendered names.
        const head = (among: typeof members): FestivalHeadline => {
          const headlineName = pickHeadlineName(festivalKey, among.map((m) => m.row));
          const headline =
            among.find((m) => m.row.name === headlineName) ??
            among.find((m) => m.row.description?.trim() === headlineName) ??
            among[0];
          const localizedName = localizeFestivalName(headlineName, i18n.language);
          const render = (at: Date) => renderFestival(localizedName, observance, at);
          return {
            ...render(fireAt),
            render,
            announces: headline.observance,
            outranksTithi: festivalKey === 'major' && HEADLINE_MAJORS.includes(headlineName),
          };
        };
        candidates.push({
          id: `${FESTIVAL_PREFIX}${festivalKey}-${day.date}`,
          fireAt,
          ...head(members),
          // Only a row whose observance STARTS today can take over. One carried
          // over from yesterday was in yesterday's group for this same
          // category, so yesterday's push already stood for it; naming it now
          // would be the second evening for one observance under another name.
          // 2036-08-07: Raksha Bandhan (announced the evening before) and
          // Yajur Upakarma both run on from the 6th and Rig Upakarma starts
          // that day, so the push names Rig Upakarma; 2035-08-19 carries only
          // the two run-ons and gets no second push.
          reHead: (spokenFor) => {
            const fresh = members.filter(
              (m) => m.observance.endsWith(`@${day.date}`) && !spokenFor(m.observance),
            );
            return fresh.length > 0 ? head(fresh) : null;
          },
        });
      }
    }
  }

  // A push whose time has passed stays in the dedupe only if it really went
  // out (see `delivered`); one that never fired is not anyone's partner.
  const live =
    delivered === undefined
      ? candidates
      : candidates.filter((r) => r.fireAt.getTime() >= nowMs || delivered.has(r.id));
  return dedupeReminders(live).filter(
    (r) => r.fireAt.getTime() >= nowMs && r.fireAt.getTime() <= cutoffMs,
  );
}

/**
 * One push per OBSERVANCE, whichever toggles and days it reaches the user
 * through. Runs over the whole candidate window — including pushes already in
 * the past that really went out (`enumerateReminders`' `delivered`) and a few
 * days past the horizon — so the outcome for any one day never depends on when
 * the app happens to be opened.
 *
 * 1. A tithi reminder yields to a festival push for an observance it covers
 *    when that push is the more specific title. A tithi title is a fixed
 *    generic string per toggle; a festival title interpolates the headline
 *    name. So when the festival's headline is a named ANNUAL festival —
 *    `HEADLINE_MAJORS`, which is exactly that list, and from which the monthly
 *    observances the tithi toggles exist for (Sankashti Chaturthi) are
 *    deliberately absent — the festival wins and the tithi entry goes: Maha
 *    Shivaratri is both the `shivaratri` tithi and a `major` festival, and
 *    "🔱 Shivratri tomorrow" would otherwise replace "🪔 Maha Shivaratri". A
 *    moon-phase entry also yields to a festival push for a festival it is
 *    linked to on a NEIGHBOURING day (`yieldsTo`), whatever the ranking: that
 *    push announces the observance on the day it is kept, which this entry
 *    cannot.
 * 2. A festival push loses its headline row when a surviving tithi reminder
 *    already speaks for it — every Ekadashi date feeds both the tithi matcher
 *    and the `ekadashi` category. It is then named after another row of its
 *    group that starts that day and nothing speaks for (`reHead`), and goes
 *    only when there is none. Testing the push's whole group up front would
 *    silence genuinely distinct festivals that merely share the date: across
 *    2024–2030 that drops Karva Chauth six times and Kajari Teej five, because
 *    each sits in the same `major` group as that month's Sankashti Chaturthi.
 * 3. Of what is left, earliest first, a push is a repeat when EARLIER pushes
 *    already announced what it would announce: the second day of a two-day
 *    run in the table (see `observanceOf`). A tithi push goes when every
 *    observance it covers is taken; a festival push whose headline row is
 *    taken is re-headed as in step 2 and goes only when no fresh row is left
 *    — so the second day of Kajari Teej no longer takes the Sankashti
 *    Chaturthi that starts that day down with it. The earliest is kept, so the
 *    user is told before the first day the observance can be kept, never
 *    after it. A split Ekadashi is NOT a repeat — the Smarta and Vaishnava
 *    fasts are different rows.
 *
 * Matching on the rendered title cannot work: the templates never produce the
 * same string for one event ("🔱 Shivratri tomorrow" vs "🪔 Maha Shivaratri"),
 * so every step compares the observances behind the copy.
 *
 * Replayed over 2024–2031 of the panchang-ts 5.3 tables (5.4 removed almost
 * every two-day run, so these counts are historical) with every toggle on and
 * region 'all', one enumeration: 1624 pushes keyed by (date, row) → 1528. Keyed by
 * observance, the drops are the Vat Savitri (Amavasya) years whose aparahna
 * anchoring put the festival the day before the sunrise Amavasya (2025,
 * 2029–2031), the 2027 Vat Savitri (Purnima) repeat, the second day of 68
 * other runs (Masik Karthigai 55, Vinayaka Chaturthi 4, Pradosha 4, Masik
 * Shivaratri 3, Durga Ashtami 2027, Jagannath Rath Yatra 2030), and — with the
 * festivals `MOON_PHASE_FESTIVAL` links by key — the Purnima / Amavasya push
 * on 23 Holi / Hanuman Jayanti / Raksha Bandhan evenings and 8 Diwalis. The
 * re-heading gives back 7 pushes to festivals that only shared a group with a
 * row already spoken for (Masik Karthigai 5, Guru Pushya, Basi Raja) and
 * moves 4 Masik Karthigai pushes to the evening before the FIRST day of their
 * run. Simulating the app being opened at 12:00 and 19:30 every day over the
 * same span — each open re-enumerating while earlier pushes fire in between —
 * fires exactly those 1528, and so does every other open pattern tried
 * (12:00; 19:05; 20:05; 12:00 + 19:30 + 20:30; four opens a day). The old
 * horizon-only dedupe fired 2227 there, 618 of them a second push for
 * something already announced that evening.
 */
function dedupeReminders(candidates: ScheduledReminder[]): ScheduledReminder[] {
  const isTithi = (r: ScheduledReminder) => r.id.startsWith(TITHI_PREFIX);

  // 1.
  const announced = new Set<string>();
  const outranked = new Set<string>();
  for (const r of candidates) {
    if (r.announces === undefined) continue;
    announced.add(r.announces);
    if (r.outranksTithi) outranked.add(r.announces);
  }
  const afterStep1 = candidates.filter(
    (r) =>
      !isTithi(r) ||
      !(
        (r.covers ?? []).some((o) => outranked.has(o)) ||
        (r.yieldsTo ?? []).some((o) => announced.has(o))
      ),
  );

  // 2.
  const coveredByTithi = new Set<string>();
  for (const r of afterStep1) {
    if (!isTithi(r)) continue;
    for (const o of r.covers ?? []) coveredByTithi.add(o);
  }
  const isCovered = (o: string) => coveredByTithi.has(o);
  const afterStep2: ScheduledReminder[] = [];
  for (const r of afterStep1) {
    if (r.announces === undefined || !isCovered(r.announces)) {
      afterStep2.push(r);
      continue;
    }
    const next = r.reHead?.(isCovered);
    if (next) afterStep2.push({ ...r, ...next });
  }

  // 3. Earliest first; `sort` is stable, so same-instant entries keep their
  // enumeration order.
  const claimed = new Set<string>();
  const isSpoken = (o: string) => claimed.has(o) || coveredByTithi.has(o);
  const kept = new Map<ScheduledReminder, ScheduledReminder>();
  const byFireTime = [...afterStep2].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  for (const r of byFireTime) {
    if (r.announces !== undefined) {
      if (!claimed.has(r.announces)) {
        claimed.add(r.announces);
        kept.set(r, r);
        continue;
      }
      // Its headline row was already announced. Name the push after another
      // row of its group that nothing has spoken for yet, or drop it.
      const next = r.reHead?.(isSpoken);
      if (!next) continue;
      claimed.add(next.announces);
      kept.set(r, { ...r, ...next });
      continue;
    }
    const speaksFor = r.covers ?? [];
    if (speaksFor.length > 0 && speaksFor.every((o) => claimed.has(o))) continue;
    for (const o of speaksFor) claimed.add(o);
    kept.set(r, r);
  }
  const out: ScheduledReminder[] = [];
  for (const r of afterStep2) {
    const final = kept.get(r);
    if (final) out.push(final);
  }
  return out;
}

// ─── Navratri 9-day notification sequence ────────────────────────────────────
//
// One morning push per day during Sharad Navratri, plus Vijayadashami (Day 10).
// Each day's body references the Navadurga form, the day's bhog, and (on Day 1)
// the computed Ghatasthapana muhurat. Gated by `prefs.festival.major` — we
// don't add a new pref key because Navratri is *the* canonical major festival
// and a separate toggle would just complicate the settings screen.
//
// We pre-render the body text at schedule time (rather than scheduling a
// recurring trigger) because each day has different content. Cancel-and-
// reschedule on every settings change is safe — each entry has a deterministic
// id, so re-scheduling is idempotent.

export function enumerateNavratriReminders(
  prefs: ReminderPrefs,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS,
  coords?: { lat: number; lon: number } | null,
  ayanamsa?: import('panchang-ts').AyanamsaType,
  masaSystem?: import('panchang-ts').MasaSystem,
): ScheduledReminder[] {
  if (!prefs.festival.major) return [];

  const window: NavratriWindow | null = nextNavratri('sharad', now, {
    coords: coords ?? undefined,
    ayanamsa,
    masaSystem,
  });
  if (!window) return [];

  const { hour, minute } = parseHHmm(NAVRATRI_MORNING_TIME, 8);
  const out: ScheduledReminder[] = [];
  const nowMs = now.getTime();
  const cutoffMs = nowMs + horizonDays * 24 * 60 * 60 * 1000;

  // `computeGhatasthapanaMuhurat` is a full `getDailyPanchang(computeEndTimes)`
  // — by far the most expensive thing in this module — and TWO places below
  // want it: the Day-1 morning body, and the T-30 muhurat reminder after the
  // loop. Each used to compute it independently, and `nextNavratri` always
  // returns a window, so for the ~11 months a year Navratri is outside the
  // 30-day horizon both results were computed and thrown away on a date test,
  // on every cold start and every resume. Memoise so it runs at most once, and
  // let each caller gate on its own horizon test BEFORE asking.
  const day1 = window.days[0];
  let ghatasthapana: ReturnType<typeof computeGhatasthapanaMuhurat> | undefined;
  const getGhatasthapana = (): ReturnType<typeof computeGhatasthapanaMuhurat> => {
    if (ghatasthapana === undefined) {
      ghatasthapana = day1
        ? computeGhatasthapanaMuhurat(day1.date, {
            coords: coords ?? undefined,
            ayanamsa,
            masaSystem,
          })
        : null;
    }
    return ghatasthapana;
  };

  // 9 morning pushes (Day 1..9) + Day 10 Vijayadashami. Day 9 and Day 10 can
  // land on the same civil date — in the shipped table that was 4 of 8 years,
  // and under panchang-ts 5.3 the table itself put Maha Navami and Dussehra on
  // one day in 2028. The
  // two ids differ (`d9-…` / `d10-…`) so both survived and fired at 08:00
  // together, one saying "offer bhog to Siddhidatri" and the other "Navratri is
  // over". Fold Day 10 into the Day-9 push instead of stacking them.
  const day9 = window.days[8];
  const day10Collides =
    day9 != null && navratriDayYmd(window.vijayadashami) === navratriDayYmd(day9.date);
  const days: { day: number; date: Date; entry: NavratriDay | null }[] = [
    ...window.days.map(d => ({ day: d.day as number, date: d.date, entry: d })),
    ...(day10Collides ? [] : [{ day: 10, date: window.vijayadashami, entry: null }]),
  ];

  for (const slot of days) {
    const fireAt = new Date(slot.date);
    fireAt.setHours(hour, minute, 0, 0);
    if (fireAt.getTime() < nowMs || fireAt.getTime() > cutoffMs) continue;

    const id = `${NAVRATRI_PREFIX}d${slot.day}-${navratriDayYmd(slot.date)}`;

    if (slot.day === 10) {
      out.push({
        id,
        fireAt,
        title: i18n.t('navratri.notif.day10Title'),
        body: i18n.t('navratri.notif.day10Body'),
      });
      continue;
    }

    const entry = slot.entry!;
    const form = NAVADURGA_FORMS[slot.day - 1];
    const lang = i18n.language === 'hi' ? 'hi' : 'en';

    let body: string;
    if (slot.day === 1) {
      // Day 1 includes Ghatasthapana muhurat in the body, and an additional
      // T-30min muhurat-start reminder is appended after the loop. `slot.date`
      // here IS `window.days[0].date`, so both share the one memoised compute.
      const gm = getGhatasthapana();
      // `day1Body` interpolates the window mid-sentence, so an empty string
      // would push "…auspicious window . Today is …". Use the window-free
      // variant when no muhurat could be published (Pratipada already gone at
      // sunrise with no Abhijit to fall back on, or a panchang compute failure).
      body = gm
        ? i18n.t('navratri.notif.day1Body', {
            form: form.name[lang],
            muhurat: formatMuhuratRange(gm.startLocal, gm.endLocal),
          })
        : i18n.t('navratri.notif.day1BodyNoMuhurat', { form: form.name[lang] });
    } else if (slot.day === 9 && day10Collides) {
      // Vijayadashami falls on Day 9 this year — one push carrying both, so
      // the user still learns Dashami is today.
      body = i18n.t('navratri.notif.day9And10Body', {
        form: form.name[lang],
        color: entry.color.name[lang],
        bhog: form.bhog[lang],
        // Until the combined string lands, fall back to the Day-9 wording —
        // still true, just missing the Vijayadashami line.
        defaultValue: i18n.t('navratri.notif.dayKanyaBody', {
          form: form.name[lang],
          color: entry.color.name[lang],
          bhog: form.bhog[lang],
        }),
      });
    } else if (slot.day === 8 || slot.day === 9) {
      // Days 8 & 9 add the Kanya Pujan reminder line.
      body = i18n.t('navratri.notif.dayKanyaBody', {
        form: form.name[lang],
        color: entry.color.name[lang],
        bhog: form.bhog[lang],
      });
    } else {
      body = i18n.t('navratri.notif.dayBody', {
        form: form.name[lang],
        color: entry.color.name[lang],
        bhog: form.bhog[lang],
      });
    }

    out.push({
      id,
      fireAt,
      title: i18n.t('navratri.notif.dayTitle', { day: slot.day, form: form.name[lang] }),
      body,
    });
  }

  // Day-1 Ghatasthapana muhurat reminder — fires ~30 minutes before muhurat
  // start. Skipped if the muhurat can't be computed (no coords) or its T-30
  // moment is already past / outside the horizon.
  //
  // Horizon-test Day 1 BEFORE reaching for the muhurat. The reminder fires 30
  // minutes before a window that always falls on Day 1 itself, so Day 1's own
  // civil-day bounds (widened by that 30 minutes) are enough to rule it in or
  // out — no panchang compute needed to discover it is eleven months away.
  if (day1) {
    const day1Ms = new Date(
      day1.date.getFullYear(),
      day1.date.getMonth(),
      day1.date.getDate(),
    ).getTime();
    // A full day of slack on each side, not the 30 minutes the reminder itself
    // sits ahead of the window. `computeGhatasthapanaMuhurat` resolves the
    // muhurat in the PLACE's timezone, while `day1Ms` is device-local midnight,
    // so a user in Los Angeles with an Indian birth place gets an instant ~8h
    // ahead of the device-local day it belongs to. Tight bounds would then drop
    // the reminder for the few hours Day 1 straddles the horizon edge. This
    // stays a cheap civil-day test — the point is only to skip the compute for
    // the ~11 months Navratri is nowhere near the horizon.
    const earliestPossible = day1Ms - 24 * 60 * 60 * 1000;
    const latestPossible = day1Ms + 48 * 60 * 60 * 1000;
    const gm =
      earliestPossible <= cutoffMs && latestPossible >= nowMs ? getGhatasthapana() : null;
    if (gm) {
      const reminderAt = new Date(gm.start.getTime() - 30 * 60 * 1000);
      const reminderMs = reminderAt.getTime();
      if (reminderMs >= nowMs && reminderMs <= cutoffMs) {
        // The window is quoted in the body, so the copy has to match the moment
        // the push actually lands. A quiet-hours shift can move a pre-dawn T-30
        // past the window's own start — the default 22:00–06:00 window does
        // exactly that for a 05:24 reminder — and "begins in about 30 minutes"
        // then contradicts the range printed in the same sentence.
        const render = (at: Date) => {
          if (at.getTime() < gm.start.getTime()) {
            return {
              title: i18n.t('navratri.notif.day1MuhuratTitle'),
              body: i18n.t('navratri.notif.day1MuhuratBody', {
                range: formatMuhuratRange(gm.startLocal, gm.endLocal),
              }),
            };
          }
          return {
            title: i18n.t('navratri.notif.day1MuhuratTitle'),
            body: i18n.t('navratri.notif.day1MuhuratBodyOpen', {
              end: formatMuhuratTime(gm.endLocal),
              defaultValue: i18n.t('navratri.notif.day1MuhuratBody', {
                range: formatMuhuratRange(gm.startLocal, gm.endLocal),
              }),
            }),
          };
        };
        out.push({
          id: `${NAVRATRI_PREFIX}ghatasthapana-${navratriDayYmd(day1.date)}`,
          fireAt: reminderAt,
          ...render(reminderAt),
          // Dropped entirely once the window has closed — nothing useful left
          // to say — which `rescheduleReminders` handles via `muhuratEnd`.
          render,
          muhuratEnd: gm.end,
        });
      }
    }
  }

  return out;
}

// ─── Scheduling side effects ──────────────────────────────────────────────────

// ── Delivery ledger ─────────────────────────────────────────────────────────
// The dedupe pass judges a push partly against pushes that have ALREADY fired
// (the first evening of a two-evening observance), and the only record of
// those is ours: once a notification fires, the OS queue forgets it. So every
// pass leaves behind the identifiers it left queued and when each was due, and
// the next pass reads back which of them came due in between. Only the tithi /
// festival namespaces take part in the dedupe, so only they are recorded; the
// ledger holds the ~30-day horizon plus a few days of history, a few dozen
// short entries. It lives in its own kv-store key, not the persisted app store:
// it is a cache the scheduler can always rebuild — lost, the worst case is one
// repeat push for an observance that straddles the loss — so it needs no
// schema version and no migration.

/** identifier → fire instant (ms) the OS was last left holding it for. */
type DeliveryLedger = Record<string, number>;

async function readDeliveryLedger(): Promise<DeliveryLedger> {
  const raw = await AsyncStorage.getItem(DELIVERY_LEDGER_KEY).catch(() => null);
  const ledger: DeliveryLedger = {};
  if (!raw) return ledger;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return ledger;
  }
  if (parsed === null || typeof parsed !== 'object') return ledger;
  for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof at === 'number' && Number.isFinite(at)) ledger[id] = at;
  }
  return ledger;
}

/**
 * The identifiers whose push has gone out: queued by an earlier pass for an
 * instant that has since passed. An identifier never queued — its toggle was
 * off, the permission missing, the iOS budget cut it, the dedupe dropped it —
 * is absent, and so is one that was cancelled before it came due (the next
 * pass rewrote the ledger without it).
 */
function deliveredIdsFrom(ledger: DeliveryLedger, nowMs: number): Set<string> {
  const out = new Set<string>();
  for (const [id, at] of Object.entries(ledger)) if (at <= nowMs) out.add(id);
  return out;
}

/**
 * The history that is still in reach of the dedupe (already due, not yet
 * stale), plus `queued`: what the OS now holds, which after a pass is exactly
 * the pass's own entries — the diff path cancels everything else it owns and
 * the rewrite path cleared it all first.
 */
async function writeDeliveryLedger(
  previous: DeliveryLedger,
  queued: { id: string; fireAtMs: number }[],
  nowMs: number,
): Promise<void> {
  const next: DeliveryLedger = {};
  for (const [id, at] of Object.entries(previous)) {
    if (at <= nowMs && at >= nowMs - DELIVERY_LEDGER_KEEP_MS) next[id] = at;
  }
  for (const { id, fireAtMs } of queued) {
    if (id.startsWith(TITHI_PREFIX) || id.startsWith(FESTIVAL_PREFIX)) next[id] = fireAtMs;
  }
  await AsyncStorage.setItem(DELIVERY_LEDGER_KEY, JSON.stringify(next)).catch(() => {});
}

export async function rescheduleReminders(
  prefs: ReminderPrefs,
  times: ReminderTimes = {},
  quietHours?: QuietHours,
  navratriCtx?: {
    coords?: { lat: number; lon: number } | null;
    ayanamsa?: import('panchang-ts').AyanamsaType;
    masaSystem?: import('panchang-ts').MasaSystem;
  },
  pass?: SchedulePass,
): Promise<void> {
  if (!Notifications) return;
  // The shared, canAskAgain-aware check: it only raises the system dialog when
  // the OS can still show one, and never the "Open Settings" alert — this runs
  // from the cold-start / resume pass with no toggle in the user's hand. The
  // toggles themselves take the Settings path before they ever turn on (see
  // `useNotificationPermissionGate`), so a blocked permission here just means
  // nothing is written until the user re-allows it; the next foreground pass
  // then schedules the whole horizon.
  const granted = await requestNotificationPermission();
  const nowMs = Date.now();
  const ledger = await readDeliveryLedger();
  if (!granted) {
    // Whatever an earlier pass queued will not be shown while the permission
    // is off, so it must not count as delivered when it comes due.
    await writeDeliveryLedger(ledger, [], nowMs);
    return;
  }

  // With a pass we reuse ITS single read of the OS queue and cancel only what
  // the new horizon no longer wants (below). Without one — the settings screen
  // calls this directly — keep the old clear-everything-we-own behaviour. A
  // rewrite pass still reuses the pass's read rather than issuing its own.
  const diff = pass !== undefined && !pass.fullRewrite;
  if (!diff) {
    const queued =
      pass?.existing ??
      (await Notifications.getAllScheduledNotificationsAsync().catch(() => [])).map(
        (n) => n.identifier,
      );
    await cancelIds([...queued].filter(isOwnedReminderId));
  }

  // Region is read here rather than threaded through every caller: it is not
  // one of the inputs the reminder screen debounces on, and the whole horizon
  // is re-enumerated on every foreground and cold start anyway, so a Region
  // change lands on the next app open at the latest. Before the store has
  // hydrated this is the default 'all', which filters nothing.
  const region = useStore.getState().region;
  // The month system moves the days of a few observances (see
  // `festivalsForDay`). Unlike Region it IS one of this pass's inputs: the
  // callers pass it for Navratri and re-run on a change.
  const masaSystem = navratriCtx?.masaSystem ?? useStore.getState().masaSystem;

  const now = new Date(nowMs);
  const desired = [
    ...enumerateReminders(
      prefs,
      now,
      HORIZON_DAYS,
      times,
      region,
      deliveredIdsFrom(ledger, nowMs),
      masaSystem,
    ),
    ...enumerateNavratriReminders(
      prefs,
      now,
      HORIZON_DAYS,
      navratriCtx?.coords,
      navratriCtx?.ayanamsa,
      navratriCtx?.masaSystem,
    ),
  ];
  // Resolve each fire time BEFORE the iOS cap below ranks anything: quiet
  // hours can move a trigger, and a shifted Ghatasthapana T-30 that lands past
  // its own window drops out entirely, so the cap has to see the entries that
  // will actually be written, at the instants they will actually fire.
  let entries: { r: ScheduledReminder; fireAt: Date }[] = [];
  for (const r of desired) {
    const fireAt = quietHours?.enabled
      ? applyQuietHoursShift(r.fireAt, {
          enabled: true,
          startHHmm: quietHours.startHHmm,
          endHHmm: quietHours.endHHmm,
        })
      : r.fireAt;
    if (r.muhuratEnd && fireAt.getTime() >= r.muhuratEnd.getTime()) continue;
    entries.push({ r, fireAt });
  }

  // iOS keeps only the 64 soonest pending local notifications per app and
  // silently drops the rest, so the union of everything the app queues has to
  // fit — see the budget in `notifications.ts`. This scheduler's share is
  // IOS_REMINDER_BUDGET (46): the daily reminder and sunrise alert reserve 7
  // each out of 60. Keep the SOONEST entries by fire time so the cut lands on
  // the far end of the 30-day horizon, which the rolling pass re-adds on the
  // next foreground anyway. Whatever is cut but still queued from an earlier
  // pass is cancelled through `desiredIds` below, so the queue never creeps
  // over the budget across passes. Android is never capped: same set, same
  // order, same native calls as before.
  if (Platform.OS === 'ios') entries = soonest(entries, IOS_REMINDER_BUDGET);

  const desiredIds = new Set<string>();
  // What the OS holds for us once this pass is done, for the delivery ledger.
  // Recorded as each entry lands, and written even if a native call throws
  // half-way, so the ledger never claims a push this pass failed to queue.
  const queued: { id: string; fireAtMs: number }[] = [];
  try {
    for (const { r, fireAt } of entries) {
      desiredIds.add(r.id);
      // Identifier already queued and nothing that moves a trigger time or
      // re-renders copy has changed — the OS holds exactly what we would write.
      if (diff && pass!.existing.has(r.id)) {
        queued.push({ id: r.id, fireAtMs: fireAt.getTime() });
        continue;
      }
      // Re-render AFTER the shift: the copy is written relative to when the
      // notification lands, and quiet hours can move it onto a different day.
      const { title, body } = r.render ? r.render(fireAt) : { title: r.title, body: r.body };
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
      queued.push({ id: r.id, fireAtMs: fireAt.getTime() });
    }

    // Everything we own that rolled off the horizon (or whose toggle was just
    // switched off) — the diff-path equivalent of the blanket clear above.
    if (diff) {
      await cancelIds(
        staleIdsFor(pass, [TITHI_PREFIX, FESTIVAL_PREFIX, NAVRATRI_PREFIX], desiredIds),
      );
    }
  } finally {
    await writeDeliveryLedger(ledger, queued, nowMs);
  }
}

/** The `limit` entries with the earliest fire times, earliest first. Returns the
 *  input untouched (same array, same order) when it already fits. */
function soonest<T extends { fireAt: Date }>(entries: T[], limit: number): T[] {
  if (entries.length <= limit) return entries;
  return [...entries].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, limit);
}

/** The three identifier namespaces this scheduler owns. */
function isOwnedReminderId(id: string): boolean {
  return (
    id.startsWith(TITHI_PREFIX) ||
    id.startsWith(FESTIVAL_PREFIX) ||
    id.startsWith(NAVRATRI_PREFIX)
  );
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await cancelIds(existing.map((n) => n.identifier).filter(isOwnedReminderId));
  // Nothing of ours is queued any more; keep only the history that did fire.
  await writeDeliveryLedger(await readDeliveryLedger(), [], Date.now());
}

/** True if any reminder is currently enabled — used to decide whether to call rescheduleReminders on foreground. */
export function hasAnyReminderEnabled(prefs: ReminderPrefs): boolean {
  return (
    Object.values(prefs.tithi).some(Boolean) ||
    Object.values(prefs.festival).some(Boolean)
  );
}
