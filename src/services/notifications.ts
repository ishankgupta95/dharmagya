import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '@/i18n';
import { vratFestivalNameForDate } from '@/utils/vrat';

// expo-notifications Android push support was removed from Expo Go in SDK 53.
// Skip the require entirely in Expo Go to prevent the native error overlay.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Native module unavailable. All notification calls become no-ops.
  }
}

// Legacy single-shot identifier, kept for cancel-on-upgrade from older installs.
const LEGACY_DAILY_REMINDER_ID = 'dharmagya-daily-reminder';
const DAILY_REMINDER_PREFIX = 'dharmagya-daily-reminder-';
const SUNRISE_ALERT_ID = 'dharmagya-sunrise-alert';
// Rolling horizon: we re-schedule this many days ahead on each call so that
// each day's reminder body can reference tomorrow's vrat (if any).
const DAILY_REMINDER_HORIZON_DAYS = 14;

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Daily Reminder (7:00 AM) ─────────────────────────────────────────────────
//
// We schedule one DATE-triggered notification per day for the next
// DAILY_REMINDER_HORIZON_DAYS days, instead of a single recurring DAILY trigger.
// This lets each day's body reference tomorrow's vrat by name (if any). The
// horizon is re-scheduled on every call — safe because each day has a
// deterministic identifier `dharmagya-daily-reminder-YYYY-MM-DD`, so cancel +
// re-schedule is a no-op for unchanged days.

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dailyReminderIdFor(date: Date): string {
  return `${DAILY_REMINDER_PREFIX}${ymd(date)}`;
}

function dailyReminderBody(triggerDate: Date): string {
  const tomorrow = new Date(triggerDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const vrat = vratFestivalNameForDate(tomorrow);
  if (vrat) {
    return i18n.t('notifications.dailyReminderBodyWithVrat', {
      defaultValue: '{{vrat}} is tomorrow. Prepare your prayers.',
      vrat: vrat.name,
    });
  }
  return i18n.t('notifications.dailyReminderBody');
}

export async function scheduleDailyReminder(): Promise<boolean> {
  if (!Notifications) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  // Clear the legacy single-shot recurring notification from earlier builds.
  await Notifications.cancelScheduledNotificationAsync(LEGACY_DAILY_REMINDER_ID).catch(() => {});

  const now = new Date();
  for (let i = 0; i < DAILY_REMINDER_HORIZON_DAYS; i++) {
    const triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + i);
    triggerDate.setHours(7, 0, 0, 0);

    // Skip if this 7 AM has already passed for today.
    if (triggerDate.getTime() <= now.getTime()) continue;

    const id = dailyReminderIdFor(triggerDate);
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: i18n.t('notifications.dailyReminderTitle'),
        body: dailyReminderBody(triggerDate),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Notifications) return;
  // Legacy single-shot trigger.
  await Notifications.cancelScheduledNotificationAsync(LEGACY_DAILY_REMINDER_ID).catch(() => {});
  // Rolling per-day triggers.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(DAILY_REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

// ─── Sunrise Alert ────────────────────────────────────────────────────────────

/**
 * Schedule a daily notification at the given sunrise hour:minute.
 * sunriseTime is a formatted string like "06:12 AM".
 */
export async function scheduleSunriseAlert(sunriseTime: string): Promise<boolean> {
  if (!Notifications) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const parsed = parseSunriseTime(sunriseTime);
  if (!parsed) return false;

  await Notifications.cancelScheduledNotificationAsync(SUNRISE_ALERT_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: SUNRISE_ALERT_ID,
    content: {
      title: i18n.t('notifications.sunriseAlertTitle'),
      body: i18n.t('notifications.sunriseAlertBody', { time: sunriseTime }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });
  return true;
}

export async function cancelSunriseAlert(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(SUNRISE_ALERT_ID).catch(() => {});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSunriseTime(timeStr: string): { hour: number; minute: number } | null {
  // Handles "06:12 AM", "6:12 AM", "06:12 am" etc.
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  return { hour, minute };
}
