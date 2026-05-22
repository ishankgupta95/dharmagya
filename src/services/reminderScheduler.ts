import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '@/i18n';
import { localizeFestivalName } from '@/i18n/festivalNames';
import type {
  ReminderPrefs,
  TithiReminderKey,
  FestivalReminderKey,
} from '@/store/useStore';
import festivalsData from '@/data/static/festivals.json';
import { applyQuietHoursShift } from '@/utils/format';
import type { QuietHours } from './notifications';
import {
  computeGhatasthapanaMuhurat,
  formatMuhuratRange,
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
/** HH:mm — when each Navratri day's morning push fires. Same time every day. */
const NAVRATRI_MORNING_TIME = '08:00';
/** Default tithi reminder time on the evening BEFORE the observance. */
const DEFAULT_TITHI_TIME = '19:00';
/** Default festival reminder time on the evening BEFORE. */
const DEFAULT_FESTIVAL_TIME = '20:00';

function parseHHmm(timeHHmm: string, fallbackHour: number): { hour: number; minute: number } {
  const [h, m] = timeHHmm.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) && h >= 0 && h < 24 ? h : fallbackHour,
    minute: Number.isFinite(m) && m >= 0 && m < 60 ? m : 0,
  };
}

// ─── Festival name matching for tithi reminders ───────────────────────────────
// Maps a TithiReminderKey to a predicate over a festival entry. We use the
// existing festivals.json as our source of tithi observance dates — panchang-ts
// precomputed these at build time, so we don't need to recompute per-device.

type FestivalEntry = { name: string; type: string };

function isEkadashi(f: FestivalEntry): boolean {
  return (
    f.type === 'ekadashi' ||
    f.type === 'smarta_ekadashi' ||
    f.type === 'vaishnava_ekadashi'
  );
}

const TITHI_MATCHES: Record<TithiReminderKey, (f: FestivalEntry) => boolean> = {
  ekadashi: isEkadashi,
  pradosha: (f) => f.type === 'pradosha',
  purnima: (f) => f.name.toLowerCase().includes('purnima'),
  amavasya: (f) => f.name.toLowerCase().includes('amavasya'),
  sankashti: (f) => f.name.toLowerCase().includes('sankashti') || f.name.toLowerCase().includes('ganesh chaturthi'),
  shivaratri: (f) =>
    f.name.toLowerCase().includes('shivaratri') ||
    f.name.toLowerCase().includes('shivratri') ||
    // v2 emits "Masik Shivaratri" for monthly observance
    f.name.toLowerCase().includes('masik shivaratri'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseObservanceDate(s: string): Date {
  return new Date(s + 'T00:00:00');
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

export function enumerateReminders(
  prefs: ReminderPrefs,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS,
  times: ReminderTimes = {}
): ScheduledReminder[] {
  const tithi = parseHHmm(times.tithi ?? DEFAULT_TITHI_TIME, 19);
  const festival = parseHHmm(times.festival ?? DEFAULT_FESTIVAL_TIME, 20);
  const out: ScheduledReminder[] = [];
  const nowMs = now.getTime();
  const cutoffMs = nowMs + horizonDays * 24 * 60 * 60 * 1000;

  // Walk through the next horizonDays worth of festival data across possibly
  // two calendar years (to handle year boundaries).
  const years = new Set<number>();
  years.add(now.getFullYear());
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + horizonDays);
  years.add(endDate.getFullYear());

  type YearEntry = { date: string; festivals: FestivalEntry[] };
  const data = festivalsData as Record<string, YearEntry[]>;

  for (const year of years) {
    const yearData = data[String(year)];
    if (!yearData) continue;
    for (const day of yearData) {
      const observance = parseObservanceDate(day.date);
      if (observance.getTime() < nowMs) continue;

      for (const f of day.festivals) {
        // festivals.json names are English. Push notifications interpolate
        // names into a localized template, so translate at the boundary.
        const localizedName = localizeFestivalName(f.name, i18n.language);

        // ── Tithi reminders ────────────────────────────────────────────────
        for (const key of Object.keys(prefs.tithi) as TithiReminderKey[]) {
          if (!prefs.tithi[key]) continue;
          if (!TITHI_MATCHES[key](f)) continue;
          const fireAt = eveningBefore(observance, tithi.hour, tithi.minute);
          if (fireAt.getTime() < nowMs || fireAt.getTime() > cutoffMs) continue;
          out.push({
            id: `${TITHI_PREFIX}${key}-${day.date}`,
            fireAt,
            title: i18n.t(`reminders.tithiTitle.${key}`, {
              defaultValue: localizedName,
            }),
            body: i18n.t('reminders.tithiBody', {
              name: localizedName,
            }),
          });
        }

        // ── Festival-category reminders ────────────────────────────────────
        // Normalize v2 subtypes (smarta_ekadashi, vaishnava_ekadashi) into the
        // single user-facing 'ekadashi' bucket. 'eclipse' is always notified
        // under 'major' (can't turn off — rare and high-signal).
        const festivalKey: FestivalReminderKey | null =
          f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
            ? 'ekadashi'
            : f.type === 'eclipse'
              ? 'major'
              : (f.type as FestivalReminderKey);
        if (festivalKey && prefs.festival[festivalKey]) {
          const fireAt = eveningBefore(observance, festival.hour, festival.minute);
          if (fireAt.getTime() >= nowMs && fireAt.getTime() <= cutoffMs) {
            out.push({
              id: `${FESTIVAL_PREFIX}${festivalKey}-${day.date}`,
              fireAt,
              title: i18n.t('reminders.festivalTitle', {
                name: localizedName,
              }),
              body: i18n.t('reminders.festivalBody', {
                name: localizedName,
              }),
            });
          }
        }
      }
    }
  }

  // Dedupe: a single (date, event) may hit both tithi and festival toggles.
  // Prefer the tithi reminder (more specific) over the festival-category one.
  const byKey = new Map<string, ScheduledReminder>();
  for (const r of out) {
    const key = `${ymd(r.fireAt)}-${r.title}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, r);
    } else if (r.id.startsWith(TITHI_PREFIX) && existing.id.startsWith(FESTIVAL_PREFIX)) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()];
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

  // 9 morning pushes (Day 1..9) + Day 10 Vijayadashami.
  const days: { day: number; date: Date; entry: NavratriDay | null }[] = [
    ...window.days.map(d => ({ day: d.day as number, date: d.date, entry: d })),
    { day: 10, date: window.vijayadashami, entry: null },
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
      // T-30min muhurat-start reminder is appended after the loop.
      const gm = computeGhatasthapanaMuhurat(slot.date, {
        coords: coords ?? undefined,
        ayanamsa,
        masaSystem,
      });
      const muhuratStr = gm ? formatMuhuratRange(gm.start, gm.end) : '';
      body = i18n.t('navratri.notif.day1Body', {
        form: form.name[lang],
        muhurat: muhuratStr,
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
  const day1 = window.days[0];
  if (day1) {
    const gm = computeGhatasthapanaMuhurat(day1.date, {
      coords: coords ?? undefined,
      ayanamsa,
      masaSystem,
    });
    if (gm) {
      const reminderAt = new Date(gm.start.getTime() - 30 * 60 * 1000);
      const reminderMs = reminderAt.getTime();
      if (reminderMs >= nowMs && reminderMs <= cutoffMs) {
        out.push({
          id: `${NAVRATRI_PREFIX}ghatasthapana-${navratriDayYmd(day1.date)}`,
          fireAt: reminderAt,
          title: i18n.t('navratri.notif.day1MuhuratTitle'),
          body: i18n.t('navratri.notif.day1MuhuratBody', {
            range: formatMuhuratRange(gm.start, gm.end),
          }),
        });
      }
    }
  }

  return out;
}

// ─── Scheduling side effects ──────────────────────────────────────────────────

export async function rescheduleReminders(
  prefs: ReminderPrefs,
  times: ReminderTimes = {},
  quietHours?: QuietHours,
  navratriCtx?: {
    coords?: { lat: number; lon: number } | null;
    ayanamsa?: import('panchang-ts').AyanamsaType;
    masaSystem?: import('panchang-ts').MasaSystem;
  },
): Promise<void> {
  if (!Notifications) return;
  const granted = await requestReminderPermission();
  if (!granted) return;

  // Clear anything we own in the reminder namespaces.
  const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of existing) {
    if (
      n.identifier.startsWith(TITHI_PREFIX) ||
      n.identifier.startsWith(FESTIVAL_PREFIX) ||
      n.identifier.startsWith(NAVRATRI_PREFIX)
    ) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }

  const desired = [
    ...enumerateReminders(prefs, new Date(), HORIZON_DAYS, times),
    ...enumerateNavratriReminders(
      prefs,
      new Date(),
      HORIZON_DAYS,
      navratriCtx?.coords,
      navratriCtx?.ayanamsa,
      navratriCtx?.masaSystem,
    ),
  ];
  for (const r of desired) {
    const fireAt = quietHours?.enabled
      ? applyQuietHoursShift(r.fireAt, {
          enabled: true,
          startHHmm: quietHours.startHHmm,
          endHHmm: quietHours.endHHmm,
        })
      : r.fireAt;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of existing) {
    if (
      n.identifier.startsWith(TITHI_PREFIX) ||
      n.identifier.startsWith(FESTIVAL_PREFIX) ||
      n.identifier.startsWith(NAVRATRI_PREFIX)
    ) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

async function requestReminderPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** True if any reminder is currently enabled — used to decide whether to call rescheduleReminders on foreground. */
export function hasAnyReminderEnabled(prefs: ReminderPrefs): boolean {
  return (
    Object.values(prefs.tithi).some(Boolean) ||
    Object.values(prefs.festival).some(Boolean)
  );
}
