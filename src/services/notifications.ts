import { Alert, Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from '@/i18n';
import { localizeFestivalName } from '@/i18n/festivalNames';
import { vratFestivalNameForDate } from '@/utils/vrat';
import { applyQuietHoursShift } from '@/utils/format';
import { getSunrise } from 'panchang-ts';
import { formatInstantForPlace, type PanchangCoords } from '@/services/astrology/panchangService';

export interface QuietHours {
  enabled: boolean;
  startHHmm: string;
  endHHmm: string;
}

// expo-notifications Android push support was removed from Expo Go in SDK 53.
// Skip the require entirely in Expo Go to prevent the native error overlay.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    // A deferred `require`, not a static import, on purpose: the native module
    // is absent in Expo Go, and a top-level import would throw while the bundle
    // evaluates — before the `isExpoGo` guard above could run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
// Legacy single-shot DAILY trigger, kept for cancel-on-upgrade. It fired at a
// clock time frozen at the moment the toggle was flipped, so a user who
// enabled it in June was still woken at 05:07 all winter by a push that said
// "Sunrise at 5:07 AM" while sunrise was 06:45.
const LEGACY_SUNRISE_ALERT_ID = 'dharmagya-sunrise-alert';
const SUNRISE_ALERT_PREFIX = 'dharmagya-sunrise-alert-';

// ─── iOS pending-notification budget ─────────────────────────────────────────
//
// iOS keeps at most 64 pending local notifications per app. Past that it
// silently keeps the 64 with the SOONEST fire dates and drops the rest — no
// error from `scheduleNotificationAsync`, the far end of the horizon just never
// fires. Android has no such cap. Everything this app queues, all namespaces,
// replayed over the shipped 2026–2031 tables with every toggle on, region
// 'all', at 00:30 so today's daily + sunrise both still count:
//
//   daily reminder     1 per day  × DAILY_REMINDER_HORIZON_DAYS
//   sunrise alert      1 per day  × SUNRISE_ALERT_HORIZON_DAYS
//   tithi / festival   ≤ 23 in a 30-day window after the dedupe pass
//                      (Oct–Nov: Navratri, Dussehra, Karva Chauth, Diwali…)
//   Navratri           ≤ 11 (9 mornings + Vijayadashami + Ghatasthapana T-30)
//
// On Android that peaks at 14 + 14 + 23 + 10 = 61 (2031-10-15; 58 in Oct
// 2026) — three under the hard cap. One more toggle, a wider horizon or a
// denser table year tips it over with no error, and the rolling pass in
// `app/_layout.tsx` only re-adds the dropped far end on the next foreground,
// so a user who leaves the app closed for two weeks silently loses that
// fortnight's reminders. So on iOS the UNION is held at or under
// IOS_PENDING_NOTIFICATION_BUDGET by cutting the far horizon:
//
//   daily      ≤  7   IOS_DAILY_REMINDER_HORIZON_DAYS
//   sunrise    ≤  7   IOS_SUNRISE_ALERT_HORIZON_DAYS
//   reminders  ≤ 46   IOS_REMINDER_BUDGET = 60 − 7 − 7; `reminderScheduler`
//                     keeps the soonest 46 of its tithi/festival/Navratri
//                     union by fire time (the shipped tables peak at 33, so
//                     today this is headroom, not a live truncation)
//   total      ≤ 60   4 spare under the hard 64; measured peak on iOS is 47
//
// The daily + sunrise reserve is a static 14, not the pass's live counts: the
// settings screen calls each scheduler on its own with no pass, so each one
// has to fit the budget by itself, and the reserve has to hold even when the
// reminder horizon was written before daily / sunrise were switched on.
//
// Android is untouched: its horizons and the reminder enumeration are exactly
// what they were, and the cap is never applied there.
export const IOS_PENDING_NOTIFICATION_BUDGET = 60;
const IOS_DAILY_REMINDER_HORIZON_DAYS = 7;
const IOS_SUNRISE_ALERT_HORIZON_DAYS = 7;
/** Slots left on iOS for the tithi / festival / Navratri union. */
export const IOS_REMINDER_BUDGET =
  IOS_PENDING_NOTIFICATION_BUDGET - IOS_DAILY_REMINDER_HORIZON_DAYS - IOS_SUNRISE_ALERT_HORIZON_DAYS;

// Rolling horizon: we re-schedule this many days ahead on each call so that
// each day's reminder body can reference tomorrow's vrat (if any).
const DAILY_REMINDER_HORIZON_DAYS = Platform.OS === 'ios' ? IOS_DAILY_REMINDER_HORIZON_DAYS : 14;
/** Same rolling idea for the sunrise alert — each day gets its own sunrise. */
const SUNRISE_ALERT_HORIZON_DAYS = Platform.OS === 'ios' ? IOS_SUNRISE_ALERT_HORIZON_DAYS : 14;

// ─── Shared scheduling pass ───────────────────────────────────────────────────
//
// The three horizon schedulers (daily reminder, sunrise alert, and
// `reminderScheduler.rescheduleReminders`) all used to open with their own
// `getAllScheduledNotificationsAsync`, cancel every identifier they own one
// serial await at a time, then re-schedule the whole horizon — ~3 getAll + ~50
// cancels + ~48 schedules of native round trips, on every cold start AND every
// AppState 'active'. Since every identifier is deterministic
// (`dharmagya-tithi-ekadashi-2026-09-21`), on a normal resume the desired set
// is byte-identical to what is already queued and essentially all of that work
// is thrown away.
//
// A `SchedulePass` is one shared read of the OS queue threaded through all
// three, so each can cancel only `existing − desired` and schedule only
// `desired − existing`. The schedulers stay callable with no pass (the settings
// screen calls them individually), in which case they keep the old
// unconditional cancel-and-rewrite behaviour.

export interface SchedulePass {
  /** Every identifier queued in the OS, read once at the start of the pass. */
  existing: Set<string>;
  /**
   * Skip the diff and rewrite the whole namespace.
   *
   * Identifiers encode a key and a DATE but not the fire TIME, so changing
   * `tithiReminderTime`, `festivalReminderTime`, quiet hours, coordinates or
   * `language` leaves every identifier untouched while the trigger (or the
   * baked-in copy) must change — a pure diff would then be a silent no-op.
   * `beginSchedulePass` detects that from the signature; it also forces a
   * rewrite periodically, because the old cancel-and-rewrite was self-healing
   * against a queue entry the OS has dropped on its own and the diff is not.
   */
  fullRewrite: boolean;
}

/** How often to rewrite unconditionally even when nothing changed, to re-heal
 *  alarms the OS may have dropped (reboot, force-stop, battery optimisation). */
const FULL_REWRITE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Module-level, not caller-level: the effect in `app/_layout.tsx` cannot tell
// WHAT changed, it just re-runs, so the previous-values memory has to live down
// here. Process-scoped by design — a cold start has no idea what the settings
// were when the last process died, so it always takes the rewrite path.
let lastPassSignature: string | null = null;
let lastFullRewriteAtMs = 0;

/**
 * Open a scheduling pass. `signature` must fold in every setting that changes a
 * trigger time or the rendered copy WITHOUT changing an identifier — see
 * `SchedulePass.fullRewrite`. Returns null when the native module is absent, in
 * which case the schedulers are no-ops anyway.
 */
export async function beginSchedulePass(signature: string): Promise<SchedulePass | null> {
  if (!Notifications) return null;
  const queued = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const now = Date.now();
  const fullRewrite =
    signature !== lastPassSignature || now - lastFullRewriteAtMs >= FULL_REWRITE_INTERVAL_MS;
  lastPassSignature = signature;
  if (fullRewrite) lastFullRewriteAtMs = now;
  return { existing: new Set(queued.map((n) => n.identifier)), fullRewrite };
}

/** Cancel every identifier in `ids`. Shared by the three diffing schedulers. */
export async function cancelIds(ids: Iterable<string>): Promise<void> {
  if (!Notifications) return;
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

/**
 * The identifiers a pass should cancel for one namespace: everything currently
 * queued under one of `prefixes` that the new horizon does not want. Returns an
 * empty list when there is no pass (callers then fall back to a full clear).
 */
export function staleIdsFor(
  pass: SchedulePass | undefined,
  prefixes: string[],
  desired: Set<string>,
): string[] {
  if (!pass) return [];
  const out: string[] = [];
  for (const id of pass.existing) {
    if (prefixes.some((p) => id.startsWith(p)) && !desired.has(id)) out.push(id);
  }
  return out;
}

// ─── Permissions ──────────────────────────────────────────────────────────────
//
// Once notifications are denied, asking again is not always possible: iOS
// shows its dialog exactly once per install, and Android 13+ stops showing it
// after the second denial. From then on `requestPermissionsAsync` resolves
// straight to "denied" with no UI, and the only way back is the app's page in
// the system Settings app. `canAskAgain` is what tells the two apart, so every
// toggle that needs the permission reads it before deciding what to show.

/** Where the notification permission stands, reduced to what a toggle has to
 *  decide. */
export interface NotificationPermissionState {
  /** The OS will deliver this app's notifications. */
  granted: boolean;
  /**
   * Not granted, and asking would still show the system dialog. False once
   * only the Settings app can change it (and whenever `granted` is true).
   */
  canPrompt: boolean;
}

interface PermissionReply {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
}

function toPermissionState(reply: PermissionReply): NotificationPermissionState {
  const granted = reply.status === 'granted';
  return {
    granted,
    // `reply.granted` with a non-granted `status` is Android 13+ holding the
    // runtime permission while the app's notifications are switched off in
    // system settings. expo still reports `canAskAgain` there, but a request
    // cannot turn the app-level switch back on, so it shows no dialog.
    canPrompt: !granted && reply.canAskAgain && !reply.granted,
  };
}

/** Read-only: never shows anything. `{ granted: false, canPrompt: false }`
 *  when the native module is unavailable (Expo Go) or the read fails. */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!Notifications) return { granted: false, canPrompt: false };
  const reply = await Notifications.getPermissionsAsync().catch(() => null);
  if (!reply) return { granted: false, canPrompt: false };
  return toPermissionState(reply);
}

/**
 * Make sure notifications are allowed, asking only where asking can work.
 *
 * - Already granted → true, nothing shown.
 * - The OS can still prompt → its dialog is shown.
 * - It cannot (denied for good, before or during this call) → false; with
 *   `promptSettings`, first an alert offering the app's page in Settings.
 *
 * `promptSettings` is for a toggle the user has just flipped. Leave it off on
 * background paths (the cold-start / resume scheduling pass): an alert nobody
 * asked for is worse than a silently skipped reschedule.
 *
 * An Android 13+ first denial leaves the dialog available, so it reports false
 * WITHOUT the alert: the user has just said no, and flipping the toggle again
 * asks again.
 */
export async function ensureNotificationPermission(
  options: { promptSettings?: boolean } = {},
): Promise<boolean> {
  if (!Notifications) return false;
  let state = await getNotificationPermissionState();
  if (state.granted) return true;
  if (state.canPrompt) {
    const reply = await Notifications.requestPermissionsAsync().catch(() => null);
    // A failed request (iOS throws ERR_PERMISSIONS_REQUEST_NOTIFICATIONS on
    // an internal error) is not a denial: report it as not granted, but don't
    // send the user to Settings over it.
    if (!reply) return false;
    state = toPermissionState(reply);
    if (state.granted) return true;
  }
  if (options.promptSettings && !state.canPrompt) await showNotificationSettingsAlert();
  return false;
}

/** Background-safe request: the system dialog when it can appear, never the
 *  Settings alert. Used by the schedulers themselves. */
export async function requestNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermission();
}

/**
 * Read-only check used by the UI to decide whether to show a pre-prompt
 * before triggering the OS permission dialog. Does NOT prompt.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  return (await getNotificationPermissionState()).granted;
}

/** The app's own page in the system Settings app, where notifications are
 *  switched back on (iOS: Settings › Dharmagya; Android: App info). */
export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings().catch(() => {});
}

// One at a time: two toggles flipped in quick succession must not stack two
// identical alerts.
let settingsAlertOpen = false;

/**
 * "Notifications are off — Open Settings", for a toggle that needs a
 * permission the OS will no longer ask for. Resolves once the alert is
 * dismissed either way; it does NOT wait for the user to come back from
 * Settings, so the toggle stays off and is flipped again afterwards.
 */
export function showNotificationSettingsAlert(): Promise<void> {
  if (settingsAlertOpen) return Promise.resolve();
  settingsAlertOpen = true;
  return new Promise((resolve) => {
    const done = () => {
      settingsAlertOpen = false;
      resolve();
    };
    Alert.alert(
      i18n.t('settings.permissionRequired'),
      i18n.t('settings.permissionRequiredDesc'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel', onPress: done },
        {
          // Same words, already translated, under the Kundli screen's key —
          // so a build where the settings key has not landed yet still shows
          // a real label instead of a key path.
          text: i18n.t('settings.permissionOpenSettings', {
            defaultValue: i18n.t('kundli.openSettings'),
          }),
          onPress: () => {
            done();
            void openNotificationSettings();
          },
        },
      ],
      // Android: a tap outside the dialog dismisses it without either button.
      { cancelable: true, onDismiss: done },
    );
  });
}

// ─── Daily Reminder (user-configurable time) ─────────────────────────────────
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
      vrat: localizeFestivalName(vrat.name, i18n.language),
    });
  }
  return i18n.t('notifications.dailyReminderBody');
}

function parseHHmm(timeHHmm: string): { hour: number; minute: number } {
  const [h, m] = timeHHmm.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) && h >= 0 && h < 24 ? h : 7,
    minute: Number.isFinite(m) && m >= 0 && m < 60 ? m : 0,
  };
}

export async function scheduleDailyReminder(
  timeHHmm: string = '07:00',
  quietHours?: QuietHours,
  pass?: SchedulePass,
): Promise<boolean> {
  if (!Notifications) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  // Diff only when a pass says nothing time-affecting changed. Without a pass
  // (settings screen) or on a rewrite pass, every identifier is cancelled and
  // re-written exactly as before.
  const diff = pass !== undefined && !pass.fullRewrite;

  // Clear the legacy single-shot recurring notification from earlier builds. On
  // a diff pass we already know whether the OS still holds it, so skip the
  // round trip on the ~100% of devices that don't.
  if (!diff || pass!.existing.has(LEGACY_DAILY_REMINDER_ID)) {
    await Notifications.cancelScheduledNotificationAsync(LEGACY_DAILY_REMINDER_ID).catch(() => {});
  }

  const { hour, minute } = parseHHmm(timeHHmm);
  const now = new Date();
  const desired = new Set<string>();
  for (let i = 0; i < DAILY_REMINDER_HORIZON_DAYS; i++) {
    let triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + i);
    triggerDate.setHours(hour, minute, 0, 0);

    if (quietHours?.enabled) {
      triggerDate = applyQuietHoursShift(triggerDate, {
        enabled: true,
        startHHmm: quietHours.startHHmm,
        endHHmm: quietHours.endHHmm,
      });
    }

    const id = dailyReminderIdFor(triggerDate);
    if (!diff) {
      // Cancel BEFORE the past-time guard. Moving the reminder earlier in the
      // day leaves today's already-scheduled trigger (at the old, later time)
      // alive otherwise — the setting visibly failed to take effect for the
      // first day, which is exactly the one the user is watching. On the diff
      // path the same case is covered by the `staleIdsFor` sweep below: a past
      // trigger never enters `desired`, so it is cancelled there.
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }

    // Skip if this trigger has already passed today.
    if (triggerDate.getTime() <= now.getTime()) continue;
    desired.add(id);

    // Identical identifier + unchanged fire time + unchanged copy ⇒ what the OS
    // already holds is exactly what we would write.
    if (diff && pass!.existing.has(id)) continue;

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

  if (diff) await cancelIds(staleIdsFor(pass, [DAILY_REMINDER_PREFIX], desired));
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
 * Schedule the sunrise alert across a rolling horizon, one dated trigger per
 * day, each at that day's *actual* sunrise minus `offsetMin`.
 *
 * This used to install a single recurring DAILY trigger at whatever clock time
 * sunrise happened to be when the toggle was flipped, and nothing ever
 * refreshed it. Sunrise swings ~98 minutes across the year in India (and ~3
 * hours in Europe), so the alarm drifted further from sunrise every week while
 * its own body kept asserting the frozen time as fact. Rolled forward from
 * `app/_layout.tsx` on cold start and on resume, like the daily reminder.
 */
export async function scheduleSunriseAlert(
  coords: PanchangCoords,
  offsetMin: number = 0,
  pass?: SchedulePass,
): Promise<boolean> {
  if (!Notifications) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const diff = pass !== undefined && !pass.fullRewrite;

  if (!diff) {
    // Clear the whole namespace first — including the legacy fixed-time
    // trigger, which would otherwise keep firing at the old hour forever.
    await cancelSunriseAlert();
  } else if (pass!.existing.has(LEGACY_SUNRISE_ALERT_ID)) {
    await Notifications.cancelScheduledNotificationAsync(LEGACY_SUNRISE_ALERT_ID).catch(() => {});
  }

  const now = new Date();
  const desired = new Set<string>();
  for (let i = 0; i < SUNRISE_ALERT_HORIZON_DAYS; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    day.setHours(0, 0, 0, 0);

    let sunrise: Date;
    try {
      sunrise = getSunrise(day, { latitude: coords.lat, longitude: coords.lon });
    } catch {
      // No sunrise that day (polar) — nothing to announce.
      continue;
    }
    const triggerDate = new Date(sunrise.getTime() - Math.max(0, offsetMin) * 60_000);
    if (triggerDate.getTime() <= now.getTime()) continue;

    const id = `${SUNRISE_ALERT_PREFIX}${ymd(triggerDate)}`;
    desired.add(id);
    // Bail before `formatInstantForPlace`, not after: the Intl formatting is
    // the expensive half of this iteration and the queued copy is already right.
    if (diff && pass!.existing.has(id)) continue;

    const label = formatInstantForPlace(sunrise, coords);
    if (!label) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: i18n.t('notifications.sunriseAlertTitle'),
        body: i18n.t('notifications.sunriseAlertBody', { time: label }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }

  if (diff) await cancelIds(staleIdsFor(pass, [SUNRISE_ALERT_PREFIX], desired));
  return true;
}

export async function cancelSunriseAlert(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(LEGACY_SUNRISE_ALERT_ID).catch(() => {});
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(SUNRISE_ALERT_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

