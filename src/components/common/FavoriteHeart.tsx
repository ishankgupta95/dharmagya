import { useEffect } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Solid heart path. Same shape as Icon name="heart" so no re-silhouette on
// activation — only fill colour + scale animate (P7.2 spec).
const HEART_PATH =
  'M12 21 C 4 15.5 4 9.5 4 9.5 C 4 6.5 6.5 4.5 9 4.5 C 10.7 4.5 12 5.5 12 7 C 12 5.5 13.3 4.5 15 4.5 C 17.5 4.5 20 6.5 20 9.5 C 20 15.5 12 21 12 21 Z';

interface FavoriteHeartProps {
  active: boolean;
  onPress: () => void;
  size?: number;
  /** Fill when not favourited (defaults to a muted ink). */
  inactiveColor: string;
  /** Fill when favourited (usually the theme accent). */
  activeColor: string;
  accessibilityLabel?: string;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Animated heart used in the aarti / chalisa / god-detail favourite toggles.
 * On activation: Light haptic, a three-keyframe scale pulse (1 → 1.12 → 1)
 * over ~280ms, and a fill-colour interpolation from `inactiveColor` to
 * `activeColor` via `interpolateColor` on the UI thread. All transform +
 * fill animations — no layout properties touched.
 *
 * Reduced motion: the scale pulse and colour interpolation both collapse to
 * instant via `dur`.
 */
export function FavoriteHeart({
  active,
  onPress,
  size = 16,
  inactiveColor,
  activeColor,
  accessibilityLabel,
  hitSlop = 8,
  style,
}: FavoriteHeartProps) {
  const { dur } = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: dur(durations.base),
      easing: easings.standard,
    });
  }, [active, dur, progress]);

  const pathAnimatedProps = useAnimatedProps(() => ({
    fill: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
  }));

  // Declared BEFORE `useAnimatedStyle`, not after. The React Compiler freezes
  // `scale` at the point it is captured by the worklet passed to
  // `useAnimatedStyle`; a write that appears after that freeze point is
  // reported as react-hooks/immutability ("`scale` cannot be modified") and the
  // compiler then bails out of memoizing this component entirely. Writing
  // before the capture keeps the value mutable — same ordering as
  // MotionPressable. The handler has exactly one consumer — the Pressable's
  // onPress below — so referential identity is irrelevant.
  function handlePress() {
    // Light haptic on every tap — favourite toggle is a confirmation whether
    // the user is adding or removing (used on the favourites list too).
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* non-critical */ });
    scale.value = withSequence(
      withTiming(1.12, { duration: dur(140), easing: easings.standard }),
      withTiming(1, { duration: dur(140), easing: easings.standard }),
    );
    onPress();
  }

  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={style}>
      <Animated.View style={wrapStyle}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <AnimatedPath d={HEART_PATH} animatedProps={pathAnimatedProps} />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
