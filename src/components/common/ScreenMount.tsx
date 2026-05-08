import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { durations } from '@/config/motion';

interface ScreenMountProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * House screen entrance. Wraps the screen body in an `Animated.View` whose
 * `entering={FadeIn}` is scheduled by Reanimated at native mount — the worklet
 * starts on the UI thread the moment the view is added to the tree, without
 * waiting for a post-commit `useEffect` on a busy JS thread.
 *
 * This implements the P11.2 compute-behind-animation pattern: the 220ms fade
 * is the budget for any compute the screen kicks off in its own mount effects
 * (panchang day fetch, kundli compute, etc.). Compute runs in parallel with
 * the fade, not serially after it. If compute lands before the fade settles,
 * `SkeletonCrossfade` picks up the data swap inside this fade window.
 *
 * Reduced motion: layout animations default to `ReduceMotion.System`, so the
 * fade collapses to instant when the OS setting is on. No per-component
 * gating needed.
 */
export function ScreenMount({ children, style }: ScreenMountProps) {
  return (
    <Animated.View
      style={[{ flex: 1 }, style]}
      entering={FadeIn.duration(durations.base)}>
      {children}
    </Animated.View>
  );
}
