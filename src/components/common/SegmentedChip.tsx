import { useEffect, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SegmentedChipProps {
  active: boolean;
  onPress: () => void;
  /** Background color when inactive (usually transparent). */
  inactiveBg: string;
  /** Background color when active. */
  activeBg: string;
  /** Border color when inactive. */
  inactiveBorder?: string;
  /** Border color when active. */
  activeBorder?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Segmented-picker chip that interpolates its background + border colour on
 * the UI thread when `active` flips (220ms, durations.base). Scale-down on
 * press-in runs under the same wrapper so it stays snappy. Per P7.2 spec:
 * never animate borderWidth directly — the border colour fades instead.
 * Selection haptic fires when a new chip becomes active (not on re-taps
 * of the same chip, and not on deactivation from external state).
 */
export function SegmentedChip({
  active,
  onPress,
  inactiveBg,
  activeBg,
  inactiveBorder,
  activeBorder,
  children,
  style,
  accessibilityLabel,
}: SegmentedChipProps) {
  const { dur } = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: dur(durations.base),
      easing: easings.standard,
    });
  }, [active, dur, progress]);

  const hasBorder = inactiveBorder !== undefined && activeBorder !== undefined;

  const animatedStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(progress.value, [0, 1], [inactiveBg, activeBg]);
    const border = hasBorder
      ? interpolateColor(progress.value, [0, 1], [inactiveBorder!, activeBorder!])
      : undefined;
    return {
      backgroundColor: bg,
      ...(border !== undefined ? { borderColor: border } : null),
      transform: [{ scale: pressScale.value }],
    };
  });

  function handlePress() {
    if (!active) {
      Haptics.selectionAsync().catch(() => { /* non-critical */ });
    }
    onPress();
  }

  function handlePressIn() {
    pressScale.value = withTiming(0.985, { duration: dur(durations.instant), easing: easings.standard });
  }

  function handlePressOut() {
    pressScale.value = withTiming(1, { duration: dur(durations.fast), easing: easings.standard });
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
