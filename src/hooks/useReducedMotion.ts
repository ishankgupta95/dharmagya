import { useEffect, useState, useCallback, useMemo } from 'react';
import { AccessibilityInfo } from 'react-native';

interface UseReducedMotionResult {
  reduced: boolean;
  dur: (d: number) => number;
}

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
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setReduced(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const dur = useCallback((d: number) => (reduced ? 0 : d), [reduced]);

  return useMemo(() => ({ reduced, dur }), [reduced, dur]);
}
