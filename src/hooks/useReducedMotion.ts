import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, type EmitterSubscription } from 'react-native';

interface UseReducedMotionResult {
  reduced: boolean;
  dur: (d: number) => number;
}

/**
 * Module-level store for the OS "reduce motion" flag.
 *
 * This used to be per-instance `useState` + `useEffect`, which meant one native
 * `isReduceMotionEnabled()` round-trip AND one `reduceMotionChanged` listener
 * registration per mounted consumer. `MotionPressable` calls the hook, and it
 * has ~244 call sites (~53 live instances on Panchang, ~100 in a long chalisa),
 * so a single screen registered dozens of listeners for one global boolean —
 * and on a device with Reduce Motion actually ON, one setting change fanned out
 * into an N-wide re-render storm.
 *
 * The read is deliberately lazy: it fires on the FIRST subscriber, not at
 * module init, because this module is imported from the pre-paint graph and a
 * native call at import time is exactly the cold-start cost we're clearing.
 * The OS listener is never torn down once armed — one listener for the app's
 * lifetime is cheaper than re-fetching the flag every time the last animated
 * component unmounts.
 */
let cachedReduced = false;
let osSub: EmitterSubscription | null = null;
const subscribers = new Set<() => void>();

function setCachedReduced(value: boolean): void {
  if (value === cachedReduced) return;
  cachedReduced = value;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (osSub === null) {
    osSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setCachedReduced);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setCachedReduced)
      // A failed read leaves the cached `false`, i.e. animations stay on —
      // the same fallback the old per-instance version had.
      .catch(() => {});
  }
  return () => {
    subscribers.delete(notify);
  };
}

/** MUST return the cached primitive, never a freshly built object —
 *  `useSyncExternalStore` compares snapshots by identity and a new object every
 *  call is an infinite re-render. The `{ reduced, dur }` result object is
 *  assembled in the hook body below instead; every consumer destructures it, so
 *  only the two fields' identities matter and both are stable. */
function getSnapshot(): boolean {
  return cachedReduced;
}

/** The two possible `dur` implementations, hoisted to module scope so the
 *  returned function is referentially stable for a given `reduced` value
 *  WITHOUT a `useCallback` (which the React Compiler would rather we didn't
 *  write). `dur` is a dependency of real effects — `useEntranceStagger`:51 and
 *  `FocusReader`:170 — so its identity has to be stable on its own merits, not
 *  only when the compiler manages to memoize it. */
const durFull = (d: number) => d;
const durInstant = (_d: number) => 0;

/**
 * Subscribes to the OS "reduce motion" accessibility setting. When enabled,
 * `dur()` collapses any requested duration to 0 so withTiming completes on
 * the next frame, effectively making every Phase 7 animation instant.
 *
 * We read React Native's AccessibilityInfo directly rather than reanimated's
 * own useReducedMotion — the React-layer hook lets us share one boolean across
 * JS-side timing decisions (e.g. skipping a setTimeout-paced sequence) and
 * worklet durations in a single source of truth.
 */
export function useReducedMotion(): UseReducedMotionResult {
  const reduced = useSyncExternalStore(subscribe, getSnapshot);
  return { reduced, dur: reduced ? durInstant : durFull };
}
