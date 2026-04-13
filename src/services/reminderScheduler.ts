import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '@/i18n';
import type {
  ReminderPrefs,
  TithiReminderKey,
  FestivalReminderKey,
} from '@/store/useStore';
import festivalsData from '@/data/static/festivals.json';

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
/** Look this many days ahead when scheduling. */
const HORIZON_DAYS = 30;
/** Hour (24h) when tithi reminders fire on the evening BEFORE the observance. */
const TITHI_REMINDER_HOUR = 19;
/** Hour (24h) when festival reminders fire on the evening BEFORE. */
const FESTIVAL_REMINDER_HOUR = 20;

// ─── Festival name matching for tithi reminders ───────────────────────────────
// Maps a TithiReminderKey to a predicate over a festival entry. We use the
// existing festivals.json as our source of tithi observance dates — panchang-ts
// precomputed these at build time, so we don't need to recompute per-device.

type FestivalEntry = { name: string; type: string };

const TITHI_MATCHES: Record<TithiReminderKey, (f: FestivalEntry) => boolean> = {
  ekadashi: (f) => f.type === 'ekadashi',
  pradosha: (f) => f.type === 'pradosha',
  purnima: (f) => f.name.toLowerCase().includes('purnima'),
  amavasya: (f) => f.name.toLowerCase().includes('amavasya'),
  sankashti: (f) => f.name.toLowerCase().includes('sankashti') || f.name.toLowerCase().includes('ganesh chaturthi'),
  shivaratri: (f) => f.name.toLowerCase().includes('shivaratri') || f.name.toLowerCase().includes('shivratri'),
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

function eveningBefore(observance: Date, hour: number): Date {
  const d = new Date(observance);
  d.setDate(d.getDate() - 1);
  d.setHours(hour, 0, 0, 0);
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
export function enumerateReminders(
  prefs: ReminderPrefs,
  now: Date = new Date(),
  horizonDays: number = HORIZON_DAYS
): ScheduledReminder[] {
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
        // ── Tithi reminders ────────────────────────────────────────────────
        for (const key of Object.keys(prefs.tithi) as TithiReminderKey[]) {
          if (!prefs.tithi[key]) continue;
          if (!TITHI_MATCHES[key](f)) continue;
          const fireAt = eveningBefore(observance, TITHI_REMINDER_HOUR);
          if (fireAt.getTime() < nowMs || fireAt.getTime() > cutoffMs) continue;
          out.push({
            id: `${TITHI_PREFIX}${key}-${day.date}`,
            fireAt,
            title: i18n.t(`reminders.tithiTitle.${key}`, {
              defaultValue: f.name,
            }),
            body: i18n.t('reminders.tithiBody', {
              defaultValue: '{{name}} is tomorrow — prepare your observance.',
              name: f.name,
            }),
          });
        }

        // ── Festival-category reminders ────────────────────────────────────
        const festivalKey = f.type as FestivalReminderKey;
        if (prefs.festival[festivalKey]) {
          const fireAt = eveningBefore(observance, FESTIVAL_REMINDER_HOUR);
          if (fireAt.getTime() >= nowMs && fireAt.getTime() <= cutoffMs) {
            out.push({
              id: `${FESTIVAL_PREFIX}${festivalKey}-${day.date}`,
              fireAt,
              title: i18n.t('reminders.festivalTitle', {
                defaultValue: '🪔 {{name}}',
                name: f.name,
              }),
              body: i18n.t('reminders.festivalBody', {
                defaultValue: '{{name}} is tomorrow.',
                name: f.name,
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

// ─── Scheduling side effects ──────────────────────────────────────────────────

export async function rescheduleReminders(prefs: ReminderPrefs): Promise<void> {
  if (!Notifications) return;
  const granted = await requestReminderPermission();
  if (!granted) return;

  // Clear anything we own in the reminder namespaces.
  const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of existing) {
    if (n.identifier.startsWith(TITHI_PREFIX) || n.identifier.startsWith(FESTIVAL_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }

  const desired = enumerateReminders(prefs);
  for (const r of desired) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.fireAt,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of existing) {
    if (n.identifier.startsWith(TITHI_PREFIX) || n.identifier.startsWith(FESTIVAL_PREFIX)) {
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
