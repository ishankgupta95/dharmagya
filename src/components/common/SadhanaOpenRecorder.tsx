import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { useStore } from '@/store/useStore';
import { useMilestoneCelebration } from '@/store/useMilestoneCelebration';
import { getJaapStats } from '@/services/jaapSessions';
import { recordSessionForSadhana } from '@/services/sadhanaRecorder';

/**
 * Drives the sadhana streak from app opens (P14.4 — user-driven change from
 * the original "jaap-session-only" rule). Mounted once inside SQLiteProvider
 * in `app/_layout.tsx`. Renders nothing.
 *
 * Trigger conditions — both go through the same idempotent recorder:
 *   - **Cold start**: fires once on mount.
 *   - **Foreground transition** (`AppState` → 'active'): catches the case
 *     where the user backgrounded the app yesterday and brought it back
 *     today without restarting the process.
 *
 * The streak math itself (in `recordSadhanaEvent`) treats same-day repeats
 * as no-ops via `lastActiveYmd`, so multiple calls per day are safe — only
 * the *first* call of a new local-calendar day actually advances the count.
 * Cumulative-session and cumulative-repetition milestone scans no-op
 * automatically: those counters come from `jaap_sessions` which an app open
 * doesn't change, so only crossing a streak-day threshold (7, 21, 30, 108,
 * 365) can fire a celebration here.
 */
export function SadhanaOpenRecorder() {
  const db = useSQLiteContext();
  const sadhana = useStore((s) => s.sadhana);
  const setSadhanaState = useStore((s) => s.setSadhanaState);
  const unlockMilestone = useMilestoneCelebration((s) => s.unlock);

  // Latest values via refs so the AppState listener (long-lived) always reads
  // the current state without re-subscribing on every render. Written in an
  // effect, never during render: `tick` only ever fires from the mount effect
  // below (which runs after this one — effects flush in declaration order,
  // and on mount the refs already hold the initial values) or from an
  // AppState transition, i.e. always after a commit, so it sees the values
  // the last commit published either way.
  const sadhanaRef = useRef(sadhana);
  const setSadhanaStateRef = useRef(setSadhanaState);
  const unlockRef = useRef(unlockMilestone);
  useEffect(() => {
    sadhanaRef.current = sadhana;
    setSadhanaStateRef.current = setSadhanaState;
    unlockRef.current = unlockMilestone;
  });

  useEffect(() => {
    function tick() {
      const stats = getJaapStats(db);
      const { nextState, celebration } = recordSessionForSadhana({
        db,
        prevState: sadhanaRef.current,
        statsAfter: stats,
        nowMs: Date.now(),
      });
      if (nextState !== sadhanaRef.current) setSadhanaStateRef.current(nextState);
      if (celebration) unlockRef.current(celebration);
    }

    tick();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') tick();
    });
    return () => sub.remove();
  }, [db]);

  return null;
}
