import { type ReactNode, useState, useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import type { ColorPalette } from '@/config/theme';
import { easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ─── Base shimmer block ───────────────────────────────────────────────────────

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  colors: ColorPalette;
  /** Override the block's base fill — use when the parent surface (e.g. a
   *  NightCard plinth) differs from the screen base, otherwise the block
   *  blends into its container. */
  baseColor?: string;
  /** Override the shimmer highlight colour (default rgba(255,255,255,0.07)).
   *  Crank this up on dark plinths where the default barely registers. */
  shimmerColor?: string;
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  colors,
  baseColor,
  shimmerColor = 'rgba(255,255,255,0.07)',
}: SkeletonBlockProps) {
  const [blockWidth, setBlockWidth] = useState(0);
  const shimmerX = useSharedValue(-300);

  useEffect(() => {
    if (blockWidth <= 0) return;
    cancelAnimation(shimmerX);
    shimmerX.value = -(blockWidth + 200);
    shimmerX.value = withRepeat(
      withTiming(blockWidth + 200, { duration: 1400, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(shimmerX);
  }, [blockWidth, shimmerX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={{ width: width as number, height, borderRadius, backgroundColor: baseColor ?? colors.surfaceRecessed, overflow: 'hidden' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== blockWidth) setBlockWidth(w);
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 200, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Home screen panchang card skeleton ──────────────────────────────────────
// Mirrors the 4-row ledger + divider + sunrise/sunset row inside the home
// panchang card. Lives on a NightCard plinth, so it takes its own base /
// shimmer tones rather than the screen's surfaceRecessed (which blends into
// the dark plinth bg).

interface HomePanchangSkeletonProps {
  colors: ColorPalette;
  /** Tone used for the skeleton block fill — defaults match a dark plinth.
   *  Pass plinth-derived overlays for light mode. */
  baseColor?: string;
  shimmerColor?: string;
  dividerColor?: string;
}

export function HomePanchangSkeleton({
  colors,
  baseColor,
  shimmerColor,
  dividerColor,
}: HomePanchangSkeletonProps) {
  const blockProps = { colors, baseColor, shimmerColor };
  const divider = dividerColor ?? colors.divider;
  return (
    <View>
      {/* 4 limb rows — tithi / nakshatra / yoga / karana */}
      <View style={home.rows}>
        {[120, 140, 110, 130].map((valW, i) => (
          <View key={i} style={[home.row, i < 3 && { borderBottomColor: divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <SkeletonBlock width={56} height={9} borderRadius={4} {...blockProps} />
            <View style={home.rowMid}>
              <SkeletonBlock width={valW} height={14} borderRadius={4} {...blockProps} />
            </View>
            <SkeletonBlock width={42} height={10} borderRadius={4} {...blockProps} />
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={[home.divider, { backgroundColor: divider }]} />

      {/* Sunrise / sunset row */}
      <View style={home.sunRow}>
        <View style={home.sunItem}>
          <SkeletonBlock width={26} height={26} borderRadius={13} {...blockProps} />
          <View style={home.sunStack}>
            <SkeletonBlock width={50} height={9} borderRadius={4} {...blockProps} />
            <SkeletonBlock width={70} height={12} borderRadius={4} {...blockProps} />
          </View>
        </View>
        <View style={[home.sunSep, { backgroundColor: divider }]} />
        <View style={home.sunItem}>
          <SkeletonBlock width={26} height={26} borderRadius={13} {...blockProps} />
          <View style={home.sunStack}>
            <SkeletonBlock width={50} height={9} borderRadius={4} {...blockProps} />
            <SkeletonBlock width={70} height={12} borderRadius={4} {...blockProps} />
          </View>
        </View>
      </View>
    </View>
  );
}

const home = StyleSheet.create({
  rows: { marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  rowMid: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  sunRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  sunItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sunStack: { gap: 4 },
  sunSep: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 12 },
});

// ─── Full panchang screen skeleton ────────────────────────────────────────────
// Mirrors the date header area + Pancha Anga card with 5 limb rows.

export function PanchangSkeleton({ colors }: { colors: ColorPalette }) {
  return (
    <View style={{ gap: 16, paddingTop: 8 }}>

      {/* Pancha Anga card — 5 limb rows */}
      <View style={full.card}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={full.limbRow}>
            <View style={full.limbLeft}>
              <SkeletonBlock width={120} height={10} borderRadius={4} colors={colors} />
              <SkeletonBlock width={160} height={18} borderRadius={5} colors={colors} />
            </View>
            <SkeletonBlock width={60} height={12} borderRadius={4} colors={colors} />
          </View>
        ))}
      </View>

      {/* Sunrise / sunset row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={full.sunCard}>
          <SkeletonBlock width={24} height={24} borderRadius={12} colors={colors} />
          <SkeletonBlock width={60} height={10} borderRadius={4} colors={colors} />
          <SkeletonBlock width={80} height={18} borderRadius={5} colors={colors} />
        </View>
        <View style={full.sunCard}>
          <SkeletonBlock width={24} height={24} borderRadius={12} colors={colors} />
          <SkeletonBlock width={60} height={10} borderRadius={4} colors={colors} />
          <SkeletonBlock width={80} height={18} borderRadius={5} colors={colors} />
        </View>
      </View>

    </View>
  );
}

// ─── Calendar grid skeleton (panchang tab) ────────────────────────────────────
// Mirrors the dimensions of the real calendar so the layout doesn't jump when
// `monthData` lands. Two layouts: compact (6×7 day-cells with header rail)
// and dense (7 weekday rows × 6 week-cols transposed grid with side label).

interface CalendarGridSkeletonProps {
  layout: 'compact' | 'dense';
  colors: ColorPalette;
  /** Sunday-first 7-letter weekday labels — same array passed to CalGridDense. */
  dayHeaders: string[];
  /** True when the surrounding screen is in dark mode. Drives the default
   *  base/shimmer overlay tones — in dark mode `colors.surfaceRecessed`
   *  equals `colors.base`, so blocks would be invisible without a lighter
   *  overlay. */
  isDarkMode: boolean;
}

export function CalendarGridSkeleton({ layout, colors, dayHeaders, isDarkMode }: CalendarGridSkeletonProps) {
  // Dark mode: surfaceRecessed === base, so default fill is invisible. Use a
  // lifted-white overlay matching the home card skeleton tones.
  const baseColor = isDarkMode ? 'rgba(255,255,255,0.07)' : undefined;
  const shimmerColor = isDarkMode ? 'rgba(255,255,255,0.14)' : undefined;
  const blockProps = { colors, baseColor, shimmerColor };
  if (layout === 'dense') {
    return (
      <View style={[cal.denseWrap]}>
        <View style={[cal.denseGrid, { borderColor: colors.border }]}>
          {Array.from({ length: 7 }, (_, weekdayIdx) => {
            const isLast = weekdayIdx === 6;
            return (
              <View
                key={weekdayIdx}
                style={[
                  cal.denseRow,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                ]}>
                <View style={[cal.denseLabelCell, { borderRightColor: colors.divider }]}>
                  {/* Use a tiny block instead of the real letter to keep the
                      visual rhythm uniform; the real grid drops the weekday
                      letter in here. */}
                  <SkeletonBlock width={14} height={9} borderRadius={3} {...blockProps} />
                </View>
                {Array.from({ length: 6 }, (_, weekIdx) => (
                  <View
                    key={weekIdx}
                    style={[
                      cal.denseCell,
                      weekIdx > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.divider },
                    ]}>
                    <SkeletonBlock width={20} height={14} borderRadius={3} {...blockProps} />
                    <SkeletonBlock width="70%" height={7} borderRadius={2} {...blockProps} />
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={cal.compactHeaderRow}>
        {dayHeaders.map((d, i) => (
          <View key={i} style={cal.compactHeaderCell}>
            <SkeletonBlock width={16} height={8} borderRadius={3} {...blockProps} />
          </View>
        ))}
      </View>
      <View style={cal.compactGrid}>
        {Array.from({ length: 42 }, (_, i) => (
          <View key={i} style={cal.compactCell}>
            <View style={cal.compactCellInner}>
              <SkeletonBlock width={20} height={14} borderRadius={4} {...blockProps} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  // Compact 6×7 grid — mirrors styles.calCell / calGrid in panchang.tsx so
  // height matches the real grid exactly.
  compactHeaderRow: { flexDirection: 'row', paddingVertical: 6 },
  compactHeaderCell: { flex: 1, alignItems: 'center' },
  compactGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  compactCell: { width: `${100 / 7}%`, aspectRatio: 1 / 1.05, padding: 1.5 },
  compactCellInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dense board — mirrors CalGridDense's outer styles and the parent's
  // -16pt horizontal extension.
  denseWrap: { marginHorizontal: -16 },
  denseGrid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  denseRow: { flexDirection: 'row', minHeight: 64 },
  denseLabelCell: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  denseCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
});

// ─── Skeleton → content crossfade wrapper ─────────────────────────────────────
// Mounts skeleton + content simultaneously and crossfades them when `ready`
// flips true. Both children are absolutely stacked — a pre-sized container
// prevents layout jump. Per P7.2: skeleton opacity 1→0 + content 0→1 over
// 300ms, in parallel. Reduced motion snaps instantly.

const CROSSFADE_MS = 300;

interface SkeletonCrossfadeProps {
  ready: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonCrossfade({ ready, skeleton, children, style }: SkeletonCrossfadeProps) {
  const { dur } = useReducedMotion();
  const progress = useSharedValue(ready ? 1 : 0);
  // Keep the skeleton mounted during the outbound fade so both layers animate
  // in parallel. Drops out after the transition completes.
  const [showSkeleton, setShowSkeleton] = useState(!ready);

  useEffect(() => {
    if (ready) {
      setShowSkeleton(true);
      progress.value = withTiming(1, {
        duration: dur(CROSSFADE_MS),
        easing: easings.standard,
      });
      const t = setTimeout(() => setShowSkeleton(false), dur(CROSSFADE_MS));
      return () => {
        clearTimeout(t);
        cancelAnimation(progress);
      };
    }
    setShowSkeleton(true);
    progress.value = withTiming(0, {
      duration: dur(CROSSFADE_MS),
      easing: easings.standard,
    });
    return () => cancelAnimation(progress);
  }, [ready, dur, progress]);

  const skeletonStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={style}>
      {ready && <Animated.View style={contentStyle}>{children}</Animated.View>}
      {showSkeleton && (
        <Animated.View
          style={[ready ? StyleSheet.absoluteFill : undefined, skeletonStyle]}
          pointerEvents="none">
          {skeleton}
        </Animated.View>
      )}
    </View>
  );
}

const full = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 16,
    paddingVertical: 4,
  },
  limbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  limbLeft: { gap: 6, flex: 1 },
  sunCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
});
