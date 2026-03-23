import * as Notifications from 'expo-notifications';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'dharmsetu-daily-reminder';
const SUNRISE_ALERT_ID = 'dharmsetu-sunrise-alert';

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Daily Reminder (7:00 AM) ─────────────────────────────────────────────────

export async function scheduleDailyReminder(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: '🙏 प्रातः स्मरण',
      body: 'Begin your day with an aarti. May your morning be blessed.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 7,
      minute: 0,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

// ─── Sunrise Alert ────────────────────────────────────────────────────────────

/**
 * Schedule a daily notification at the given sunrise hour:minute.
 * sunriseTime is a formatted string like "06:12 AM".
 */
export async function scheduleSunriseAlert(sunriseTime: string): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const parsed = parseSunriseTime(sunriseTime);
  if (!parsed) return false;

  await Notifications.cancelScheduledNotificationAsync(SUNRISE_ALERT_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: SUNRISE_ALERT_ID,
    content: {
      title: '🌅 सूर्योदय',
      body: `Sunrise at ${sunriseTime}. A sacred moment for prayer.`,
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
