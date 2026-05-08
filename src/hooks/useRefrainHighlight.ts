import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  cancelAnimation,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { STAGGER_CAP_MS, easings } from '@/config/motion';
import { useReducedMotion } from './useReducedMotion';

const REFRAIN_START_OPACITY = 0.55;
const REFRAIN_HIGHLIGHT_MS = 600;

/**
 * Quiet one-shot refrain cue for the Aarti reader. After the verse stagger
 * settles (STAGGER_CAP_MS = 120ms post-P11.2), refrain lines fade from
 * 0.55 → 1.0 over 600ms, once per reader instance. No loop, no audio dep,
 * no re-run on re-render — the hook runs only on mount.
 *
 * Reduced motion: progress starts at 1 so refrain opacity is full from the
 * first frame.
 */
export function useRefrainHighlight(): AnimatedStyle<ViewStyle> {
  const { dur, reduced } = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    progress.value = withDelay(
      dur(STAGGER_CAP_MS),
      withTiming(1, {
        duration: dur(REFRAIN_HIGHLIGHT_MS),
        easing: easings.standard,
      }),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, dur]);

  return useAnimatedStyle(() => ({
    opacity: REFRAIN_START_OPACITY + progress.value * (1 - REFRAIN_START_OPACITY),
  }));
}
