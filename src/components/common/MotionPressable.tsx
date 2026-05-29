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
  withSpring,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressEvent = GestureResponderEvent;

// Damped spring tuned for tap feedback: settles in ~180ms with a tiny
// overshoot, no oscillation. Mass kept low so the press feels immediate.
const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;
// Reduced-motion spring: critically damped + stiffer so the value snaps
// without visible motion but handlers still fire.
const REDUCED_SPRING = { damping: 100, stiffness: 1000, mass: 0.5 } as const;

interface MotionPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /**
   * Scale at press-in. Cards/buttons use 0.97 (more pronounced); full-width
   * rows and small tap targets use 0.985 (subtle). Defaults to 0.985.
   */
  pressedScale?: number;
}

export const MotionPressable = forwardRef<View, MotionPressableProps>(
  function MotionPressable(
    { style, onPressIn, onPressOut, children, pressedScale = 0.985, ...rest },
    ref,
  ) {
    const { reduced } = useReducedMotion();
    const scale = useSharedValue(1);
    const spring = reduced ? REDUCED_SPRING : PRESS_SPRING;

    const handlePressIn = useCallback(
      (e: PressEvent) => {
        scale.value = withSpring(pressedScale, spring);
        onPressIn?.(e);
      },
      [scale, spring, pressedScale, onPressIn],
    );

    const handlePressOut = useCallback(
      (e: PressEvent) => {
        scale.value = withSpring(1, spring);
        onPressOut?.(e);
      },
      [scale, spring, onPressOut],
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
