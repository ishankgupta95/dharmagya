import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '@/i18n';
import { applyQuietHoursShift } from '@/utils/format';
import { hasQualifiedToday, ymdLocal, type SadhanaState } from './sadhana';
import type { QuietHours } from './notifications';

/**
 * Opt-in evening sadhana reminder (P14.4). When `sadhanaReminderEnabled` is
 * true, we schedule one DATE-triggered notification per day for the next
 * SADHANA_REMINDER_HORIZON_DAYS days at the user-chosen time (default 20:30).
 * The wording is gentle — "A quiet moment for your sadhana today" — never
 * "Streak at risk!" or any loss-threat phrasing.
 *
 * The "skip today if a session is already logged" gating is best-effort: we
 * cancel today's pending notification right after the jaap counter inserts a
 * session, so a user who already practised doesn't get the prompt that
 * evening. Tomorrow's prompt is unaffected and re-fires per the horizon.
 *
 * Phase 15 dependency note: streak data is local-only until accounts ship; a
 * reinstall wipes it, same as Calm/Headspace pre-account streaks.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  } catch {
    // Native module unavailable — service becomes a no-op.
  }
}

const SADHANA_PREFIX = 'dharmagya-sadhana-';
/** Rolling 14-day horizon mirrors the daily-reminder schedule. */
const SADHANA_REMINDER_HORIZON_DAYS = 14;

function parseHHmm(timeHHmm: string, fallbackHour: number): { hour: number; minute: number } {
  const [h, m] = timeHHmm.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) && h >= 0 && h < 24 ? h : fallbackHour,
    minute: Number.isFinite(m) && m >= 0 && m < 60 ? m : 30,
  };
}

function reminderIdFor(ymd: string): string {
  return `${SADHANA_PREFIX}${ymd}`;
}

async function requestPermissionIfNeeded(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule (or re-schedule) the rolling at-risk reminder horizon. Skips
 * today's reminder when the user has already qualified for the streak (≥1
 * jaap session this local calendar day). Past triggers are silently dropped.
 *
 * "Re-schedule" matches the call site semantics: callers run this on every
 * toggle, time change, AND after a session is logged (to roll today off and
 * keep the 14-day horizon current). The function clears anything we own
 * before installing the new horizon, so repeated calls converge cleanly.
 */
export async function rescheduleSadhanaReminder(args: {
  enabled: boolean;
  timeHHmm: string;
  sadhana: SadhanaState;
  quietHours?: QuietHours;
}): Promise<boolean> {
  if (!Notifications) return false;
  if (!args.enabled) {
    await cancelSadhanaReminders();
    return false;
  }
  const granted = await requestPermissionIfNeeded();
  if (!granted) return false;

  // Clear stale reminders we own — the horizon shifts forward each call, so
  // yesterday's identifier never matters again.
  await cancelSadhanaReminders();

  const { hour, minute } = parseHHmm(args.timeHHmm, 20);
  const now = new Date();
  const nowMs = now.getTime();
  const todayYmd = ymdLocal(now);
  const skipToday = hasQualifiedToday(args.sadhana, nowMs);

  for (let i = 0; i < SADHANA_REMINDER_HORIZON_DAYS; i++) {
    let triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + i);
    triggerDate.setHours(hour, minute, 0, 0);

    // Trigger already passed today → skip; the next loop turn handles tomorrow.
    if (triggerDate.getTime() <= nowMs) continue;

    const ymd = ymdLocal(triggerDate);
    if (skipToday && ymd === todayYmd) continue;

    if (args.quietHours?.enabled) {
      triggerDate = applyQuietHoursShift(triggerDate, {
        enabled: true,
        startHHmm: args.quietHours.startHHmm,
        endHHmm: args.quietHours.endHHmm,
      });
    }

    await Notifications.scheduleNotificationAsync({
      identifier: reminderIdFor(ymd),
      content: {
        title: i18n.t('sadhana.reminderTitle'),
        body: i18n.t('sadhana.reminderBody'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
  return true;
}

/** Cancel every sadhana reminder we own — fired on disable + on rehydration. */
export async function cancelSadhanaReminders(): Promise<void> {
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(SADHANA_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}
