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
// Roughly mirrors the vertical footprint of the real calendar so layout
// doesn't jump when `monthData` lands, but uses a small set of horizontal
// shimmer lines (one per week-row) instead of per-cell squares — quieter
// loading state that reads as "page warming up" rather than "loading 30+ tiles".

interface CalendarGridSkeletonProps {
  layout: 'compact' | 'dense';
  colors: ColorPalette;
  /** True when the surrounding screen is in dark mode. Drives the default
   *  base/shimmer overlay tones — in dark mode `colors.surfaceRecessed`
   *  equals `colors.base`, so blocks would be invisible without a lighter
   *  overlay. */
  isDarkMode: boolean;
}

// Width variation per row so the stack reads as loading paragraph text
// rather than identical bars. Indexed mod row-count.
const LINE_WIDTHS: `${number}%`[] = ['90%', '76%', '92%', '82%', '88%', '94%', '78%'];

export function CalendarGridSkeleton({ layout, colors, isDarkMode }: CalendarGridSkeletonProps) {
  // Dark mode: surfaceRecessed === base, so default fill is invisible. Use a
  // lifted-white overlay matching the home card skeleton tones.
  const baseColor = isDarkMode ? 'rgba(255,255,255,0.07)' : undefined;
  const shimmerColor = isDarkMode ? 'rgba(255,255,255,0.14)' : undefined;
  const blockProps = { colors, baseColor, shimmerColor };

  // Row count + height matches the real calendar so total vertical footprint
  // is close enough that the crossfade doesn't visibly shift surrounding
  // content. Compact = 6 weeks × ~52pt; dense = 7 weekday rows × 64pt.
  const rowCount = layout === 'dense' ? 7 : 6;
  const rowHeight = layout === 'dense' ? 64 : 52;

  return (
    <View style={layout === 'dense' ? cal.denseWrap : undefined}>
      {Array.from({ length: rowCount }, (_, i) => (
        <View key={i} style={[cal.lineRow, { height: rowHeight }]}>
          <SkeletonBlock
            width={LINE_WIDTHS[i % LINE_WIDTHS.length]}
            height={14}
            borderRadius={4}
            {...blockProps}
          />
        </View>
      ))}
    </View>
  );
}

const cal = StyleSheet.create({
  // Mirrors the dense calendar's -16pt horizontal extension so the skeleton
  // and the real grid occupy the same width slot.
  denseWrap: { marginHorizontal: -16 },
  lineRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
