import { type SQLiteDatabase } from 'expo-sqlite';

import {
  recordSadhanaEvent,
  type SadhanaState,
} from './sadhana';
import {
  findNewlyCrossed,
  listAchievedThresholds,
  recordMilestone,
  type MilestoneKind,
} from './milestones';
import { type JaapStats } from './jaapSessions';
import type { MilestoneEvent } from '@/store/useMilestoneCelebration';

/** Inputs to {@link recordSessionForSadhana}. The caller (the jaap counter)
 *  reads these from the store + the just-completed session, hands them in,
 *  and applies the returned `nextState` to the store. */
export interface RecordSessionInput {
  db: SQLiteDatabase;
  prevState: SadhanaState;
  /** Lifetime totals AFTER `insertJaapSession()` — derive with `getJaapStats(db)`. */
  statsAfter: JaapStats;
  /** When the session ended; exposed for testability. Defaults to Date.now(). */
  nowMs?: number;
  /** Optional deity slug to thread into the celebration / share card accent. */
  deityId?: string;
}

export interface RecordSessionResult {
  /** State the caller must persist via `setSadhanaState` (no-op if the
   *  rollback guard tripped — caller can still set it; same value in/out). */
  nextState: SadhanaState;
  /** The milestone the celebration should display, if any. Picked from the
   *  newly-crossed set by {@link pickHeadlineMilestone}; the others are still
   *  recorded silently. `null` when no fresh threshold was crossed. */
  celebration: MilestoneEvent | null;
  /** All milestones inserted on this session (incl. the one chosen for the
   *  celebration). Exposed for caller logging if needed. */
  recorded: readonly { kind: MilestoneKind; threshold: number }[];
  /** True iff the rollback guard tripped; caller may want to surface a
   *  hint elsewhere (we don't celebrate or fire reminders in this case). */
  rollbackFrozen: boolean;
}

/**
 * One-call orchestrator the jaap counter runs *after* `insertJaapSession`:
 *
 *   1. Advance the streak (or no-op for same-day repeats).
 *   2. Scan three threshold groups — sessions / repetitions / streak — and
 *      insert any newly-crossed ones into SQLite. The unique constraint
 *      makes the insert idempotent across replays.
 *   3. Pick exactly one milestone to celebrate visibly (rarest-first rank);
 *      return it so the caller can hand it to {@link useMilestoneCelebration}.
 *
 * Side effects: writes to `milestones_achieved`. Does NOT write to the
 * Zustand store — caller does, with `nextState`. Does NOT open the overlay —
 * caller does, with `celebration`. Keeping side effects shallow makes this
 * unit-testable.
 */
export function recordSessionForSadhana(input: RecordSessionInput): RecordSessionResult {
  const nowMs = input.nowMs ?? Date.now();

  // ── Step 1 — streak ──────────────────────────────────────────────────────
  const { state: nextState, rollbackFrozen } = recordSadhanaEvent(input.prevState, nowMs);

  if (rollbackFrozen) {
    // Frozen: don't record milestones either — a backwards clock is also a
    // suspicious milestone trigger. The next legitimate event will pick up
    // any thresholds that have since been crossed.
    return { nextState, celebration: null, recorded: [], rollbackFrozen: true };
  }

  // ── Step 2 — milestone scan ──────────────────────────────────────────────
  const recorded: { kind: MilestoneKind; threshold: number }[] = [];

  function scan(kind: MilestoneKind, newTotal: number): void {
    const already = listAchievedThresholds(input.db, kind);
    for (const threshold of findNewlyCrossed(kind, newTotal, already)) {
      if (recordMilestone(input.db, kind, threshold, nowMs)) {
        recorded.push({ kind, threshold });
      }
    }
  }

  scan('sessions', input.statsAfter.sessionCount);
  scan('repetitions', input.statsAfter.totalCount);
  scan('streak', nextState.currentStreak);

  // ── Step 3 — pick the headline milestone ────────────────────────────────
  const headline = pickHeadlineMilestone(recorded);
  const celebration: MilestoneEvent | null = headline
    ? { kind: headline.kind, threshold: headline.threshold, deityId: input.deityId }
    : null;

  return { nextState, celebration, recorded, rollbackFrozen: false };
}

/** Rank the freshly-crossed milestones to pick exactly one to celebrate.
 *  Higher absolute threshold wins; ties broken by kind rarity (streak >
 *  repetitions > sessions — streak days require *consistency*, so a 108-day
 *  streak is the rarest event by far). */
export function pickHeadlineMilestone(
  recorded: readonly { kind: MilestoneKind; threshold: number }[],
): { kind: MilestoneKind; threshold: number } | null {
  if (recorded.length === 0) return null;

  const KIND_RANK: Record<MilestoneKind, number> = {
    streak: 3,
    repetitions: 2,
    sessions: 1,
  };

  return [...recorded].sort((a, b) => {
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    return KIND_RANK[b.kind] - KIND_RANK[a.kind];
  })[0];
}
