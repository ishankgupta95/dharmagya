import { memo, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { durations, easings, stagger } from '@/config/motion';
import { palette } from '@/config/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Four gold-leaf L-shaped brackets — absolutely positioned inside any
 * rectangular container (night plinth cards, hero wells). Non-interactive
 * decoration; set `pointerEvents="none"` on the parent if overlaying content.
 *
 * The brackets themselves are simple absolutely positioned corner elements —
 * one horizontal + one vertical edge per corner, drawn with a 1px gold stroke.
 *
 * `animateEntrance` (P7.3) draws the corners in with a 40ms stagger —
 * top-left, top-right, bottom-left, bottom-right — each scaling from 0 → 1
 * over `durations.instant`. Total duration 240ms. Snapshots the prop on
 * first render so NightCard parent re-renders never retrigger the draw-in.
 */
interface CornerBracketsProps {
  color?: string;
  length?: number;
  thickness?: number;
  inset?: number;
  animateEntrance?: boolean;
}

export const CornerBrackets = memo(function CornerBrackets({
  color = palette.goldLeaf,
  length = 16,
  thickness = 1,
  inset = 8,
  animateEntrance = false,
}: CornerBracketsProps) {
  const { dur, reduced } = useReducedMotion();
  const animateRef = useRef(animateEntrance);
  const atRest = !animateRef.current || reduced;
  const initial = atRest ? 1 : 0;

  const s0 = useSharedValue(initial);
  const s1 = useSharedValue(initial);
  const s2 = useSharedValue(initial);
  const s3 = useSharedValue(initial);

  useEffect(() => {
    if (!animateRef.current) return;
    const run = (sv: SharedValue<number>, i: number) => {
      sv.value = withDelay(
        dur(i * stagger.tight),
        withTiming(1, {
          duration: dur(durations.instant),
          easing: easings.standard,
        }),
      );
    };
    run(s0, 0);
    run(s1, 1);
    run(s2, 2);
    run(s3, 3);
    return () => {
      cancelAnimation(s0);
      cancelAnimation(s1);
      cancelAnimation(s2);
      cancelAnimation(s3);
    };
  }, [s0, s1, s2, s3, dur]);

  const topLeftStyle = useAnimatedStyle(() => ({ transform: [{ scale: s0.value }] }));
  const topRightStyle = useAnimatedStyle(() => ({ transform: [{ scale: s1.value }] }));
  const bottomLeftStyle = useAnimatedStyle(() => ({ transform: [{ scale: s2.value }] }));
  const bottomRightStyle = useAnimatedStyle(() => ({ transform: [{ scale: s3.value }] }));

  const h = { width: length, height: thickness, backgroundColor: color };
  const v = { width: thickness, height: length, backgroundColor: color };
  const cornerBox = { width: length, height: length };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.abs, cornerBox, { top: inset, left: inset, transformOrigin: '0% 0%' }, topLeftStyle]}>
        <View style={[styles.abs, { top: 0, left: 0 }, h]} />
        <View style={[styles.abs, { top: 0, left: 0 }, v]} />
      </Animated.View>
      <Animated.View
        style={[styles.abs, cornerBox, { top: inset, right: inset, transformOrigin: '100% 0%' }, topRightStyle]}>
        <View style={[styles.abs, { top: 0, right: 0 }, h]} />
        <View style={[styles.abs, { top: 0, right: 0 }, v]} />
      </Animated.View>
      <Animated.View
        style={[styles.abs, cornerBox, { bottom: inset, left: inset, transformOrigin: '0% 100%' }, bottomLeftStyle]}>
        <View style={[styles.abs, { bottom: 0, left: 0 }, h]} />
        <View style={[styles.abs, { bottom: 0, left: 0 }, v]} />
      </Animated.View>
      <Animated.View
        style={[styles.abs, cornerBox, { bottom: inset, right: inset, transformOrigin: '100% 100%' }, bottomRightStyle]}>
        <View style={[styles.abs, { bottom: 0, right: 0 }, h]} />
        <View style={[styles.abs, { bottom: 0, right: 0 }, v]} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
});
