import { useEffect, useRef } from 'react';
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
 * `index * stagger.base`, capped at 400ms so late items never feel forgotten.
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
  const enabledAtMountRef = useRef(enabled);
  const progress = useSharedValue(enabledAtMountRef.current ? 0 : 1);

  useEffect(() => {
    if (!enabledAtMountRef.current) return;
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
  }, [progress, index, dur]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));
}
