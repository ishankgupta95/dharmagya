import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { durations, easings } from '@/config/motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * The house entrance motion: opacity 0→1 and translateY 8→0 over durations.base.
 * Used by screen roots and card-level containers. Runs once on mount; the
 * return value is a memoised animated style you can spread onto an
 * `Animated.View`.
 *
 * Reduced motion: dur collapses to 0 so the view appears fully in-place on the
 * next frame with no perceptible animation.
 */
export function useAnimatedMount(): AnimatedStyle<ViewStyle> {
  const { dur } = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: dur(durations.base),
      easing: easings.standard,
    });
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, dur]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));
}
