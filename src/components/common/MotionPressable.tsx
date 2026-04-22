import { forwardRef, useCallback } from 'react';
import {
  Pressable,
  type PressableProps,
  type View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressEvent = GestureResponderEvent;

interface MotionPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable wrapper that runs a subtle scale-down on press-in
 * (1 → 0.985 over durations.instant) and snaps back over durations.fast.
 * Use in place of raw Pressable / TouchableOpacity wherever a NightCard or
 * button-style card is the tap target — the scale is compositor-only, so it
 * is safe to use even on the Pixel 3a gate device.
 *
 * Reduced motion: `dur` collapses to 0, so the view snaps between scale
 * values with no perceptible animation but all press handlers still fire.
 */
export const MotionPressable = forwardRef<View, MotionPressableProps>(
  function MotionPressable(
    { style, onPressIn, onPressOut, children, ...rest },
    ref,
  ) {
    const { dur } = useReducedMotion();
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(
      (e: PressEvent) => {
        scale.value = withTiming(0.985, {
          duration: dur(durations.instant),
          easing: easings.standard,
        });
        onPressIn?.(e);
      },
      [scale, dur, onPressIn],
    );

    const handlePressOut = useCallback(
      (e: PressEvent) => {
        scale.value = withTiming(1, {
          duration: dur(durations.fast),
          easing: easings.standard,
        });
        onPressOut?.(e);
      },
      [scale, dur, onPressOut],
    );

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedPressable
        ref={ref}
        style={[style, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...rest}>
        {children}
      </AnimatedPressable>
    );
  },
);
