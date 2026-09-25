import { useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  cancelAnimation,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { STAGGER_CAP_MS, durations, easings, stagger } from '@/config/motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * Staggered entrance for list / grid items. Given a zero-based index, returns
 * an animated style that delays the shared entrance transform by
 * `index * stagger.base`, capped at `STAGGER_CAP_MS` (120ms post-P11.2) so
 * the cascade is a brief polish on top of compute that's already done — no
 * item is ever delayed long enough to read as a content delay.
 *
 * `enabled` snapshots on first render — flipping it later never retriggers
 * the animation and never halts one mid-flight. Callers use this to skip
 * animation for items beyond the initial visible set (e.g. verse 7+ in a
 * reader) without remounting or threading per-call-site refs.
 *
 * Reduced motion: all delays and durations collapse to 0 — items appear in
 * place simultaneously.
 */
export function useEntranceStagger(
  index: number,
  enabled: boolean = true,
): AnimatedStyle<ViewStyle> {
  const { dur } = useReducedMotion();
  // The first-render snapshot of `enabled` (see above). A `useState` initial
  // value holds it for the component's lifetime without reading a ref during
  // render; later values of `enabled` are ignored by design.
  const [enabledAtMount] = useState(enabled);
  const progress = useSharedValue(enabledAtMount ? 0 : 1);

  useEffect(() => {
    if (!enabledAtMount) return;
    const rawDelay = Math.min(index * stagger.base, STAGGER_CAP_MS);
    progress.value = withDelay(
      dur(rawDelay),
      withTiming(1, {
        duration: dur(durations.base),
        easing: easings.standard,
      }),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, index, dur, enabledAtMount]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));
}
