/**
 * Sadhana streak math (P14.4) — pure functions.
 *
 * A "sadhana day" is any local-calendar day with ≥1 completed jaap session.
 * Streak rules, tuned for a devotional context:
 *   - **26-hour grace window**, not midnight-strict. Night worshippers and
 *     travel-day timezone shifts shouldn't break a streak; the grace is wide
 *     enough that a 11:30 PM Mon session + 1:00 AM Wed session (~25.5h gap)
 *     still continues the streak.
 *   - **Clock-rollback guard**: every event records a monotonic high-water
 *     mark. If wall-clock drops more than 60s below the watermark on the next
 *     event, freeze the streak in place rather than silently miscount. This
 *     catches a manually-rewound device clock — the streak stays where it was
 *     until time passes the watermark again.
 *   - **Reset is gentle**, never "Streak lost!" — copy lives in i18n.
 *
 * The state itself lives in Zustand (`useStore.sadhana`); these helpers don't
 * touch storage. Caller plumbs the current state in, gets the next state out.
 */

/** Persisted streak state — mirrors the Zustand slice exactly. */
export interface SadhanaState {
  /** Consecutive days of practice — including today if today is the latest active day. */
  currentStreak: number;
  /** Local-tz YYYY-MM-DD of the last qualifying day; null until first session. */
  lastActiveYmd: string | null;
  /** Wall-clock at the last qualifying event; drives the 26h grace math. */
  lastEventEpochMs: number;
  /** Monotonic high-water mark on wall-clock — for clock-rollback detection. */
  highWatermarkEpochMs: number;
}

export const INITIAL_SADHANA_STATE: SadhanaState = {
  currentStreak: 0,
  lastActiveYmd: null,
  lastEventEpochMs: 0,
  highWatermarkEpochMs: 0,
};

/** The grace window between qualifying events. ≤ 26h continues the streak. */
export const GRACE_WINDOW_MS = 26 * 60 * 60 * 1000;
/** Tolerance for clock-rollback detection — clocks NTP-sync within seconds, so 60s is safely above noise. */
const ROLLBACK_TOLERANCE_MS = 60_000;

/** YYYY-MM-DD in the device's local timezone. */
export function ymdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Result of recording one qualifying event (a jaap session). */
export interface RecordResult {
  state: SadhanaState;
  /** True iff the streak advanced (incremented or reset to 1) on this event. */
  streakAdvanced: boolean;
  /** True iff a clock-rollback was detected and the streak was frozen. */
  rollbackFrozen: boolean;
}

/**
 * Record one qualifying event (a completed jaap session) and return the next
 * streak state. Pure — no side effects. The caller persists `result.state`.
 *
 *   - Same calendar day as `lastActiveYmd` → no change (the day already
 *     counts; multiple sessions/day don't compound).
 *   - Different day, within 26h of `lastEventEpochMs` → streak + 1.
 *   - Different day, beyond 26h → reset to 1.
 *   - Wall-clock < `highWatermarkEpochMs - 60s` → freeze the streak in place
 *     (do NOT advance, do NOT reset), don't update timestamps.
 */
export function recordSadhanaEvent(prev: SadhanaState, nowMs: number): RecordResult {
  // Clock-rollback guard. Cheap to evaluate; safe to bypass on first-ever event.
  if (prev.highWatermarkEpochMs > 0 && nowMs < prev.highWatermarkEpochMs - ROLLBACK_TOLERANCE_MS) {
    return { state: prev, streakAdvanced: false, rollbackFrozen: true };
  }

  const todayYmd = ymdLocal(new Date(nowMs));
  const watermarkNext = Math.max(prev.highWatermarkEpochMs, nowMs);

  // Same calendar day → no streak change, but bump the watermark so the
  // rollback guard stays accurate.
  if (prev.lastActiveYmd === todayYmd) {
    return {
      state: {
        ...prev,
        lastEventEpochMs: nowMs,
        highWatermarkEpochMs: watermarkNext,
      },
      streakAdvanced: false,
      rollbackFrozen: false,
    };
  }

  // First-ever event, OR new calendar day. Decide between advance and reset
  // based on the grace window measured from the previous event.
  const gap = prev.lastEventEpochMs > 0 ? nowMs - prev.lastEventEpochMs : Number.POSITIVE_INFINITY;
  const continuesStreak = gap <= GRACE_WINDOW_MS;
  const nextStreak = continuesStreak ? prev.currentStreak + 1 : 1;

  return {
    state: {
      currentStreak: nextStreak,
      lastActiveYmd: todayYmd,
      lastEventEpochMs: nowMs,
      highWatermarkEpochMs: watermarkNext,
    },
    streakAdvanced: true,
    rollbackFrozen: false,
  };
}

/**
 * Decide whether the streak's "displayed" value should still be live or has
 * silently lapsed (the user hasn't practised within the grace window of the
 * last active day's *next* day). Used for the Home badge: if the user broke
 * the streak by missing a day, show 0 rather than the stale `currentStreak`.
 *
 * The persisted value is only rolled to 0 on the next qualifying event —
 * keeping the data immutable means a paranoid user can reload and see the
 * same number, while the display reflects the soft reality.
 */
export function displayStreak(state: SadhanaState, nowMs: number): number {
  if (state.currentStreak === 0 || state.lastActiveYmd === null) return 0;
  if (state.lastEventEpochMs === 0) return 0;

  const todayYmd = ymdLocal(new Date(nowMs));
  if (state.lastActiveYmd === todayYmd) return state.currentStreak;

  const gap = nowMs - state.lastEventEpochMs;
  return gap <= GRACE_WINDOW_MS ? state.currentStreak : 0;
}

/**
 * Whether the user has already qualified today (i.e. ≥1 jaap session was
 * logged for today's local calendar date). The at-risk reminder uses this
 * to decide whether to fire tonight.
 */
export function hasQualifiedToday(state: SadhanaState, nowMs: number): boolean {
  if (!state.lastActiveYmd) return false;
  return state.lastActiveYmd === ymdLocal(new Date(nowMs));
}
