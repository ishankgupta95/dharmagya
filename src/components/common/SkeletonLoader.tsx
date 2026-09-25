import { type ReactNode, useState, useEffect, useRef } from 'react';
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

/** Width of the moving highlight band, and how long one pass takes. Shared by
 *  the per-block shimmer and the card-wide sweep so both read identically. */
const SWEEP_WIDTH = 200;
const SWEEP_MS = 1400;

const sweep = StyleSheet.create({
  band: { width: SWEEP_WIDTH, height: '100%' },
  // Clips the travelling band to the card bounds. Overflow-only, so the
  // skeleton's measured layout is unchanged.
  clip: { overflow: 'hidden' },
});

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
  const shimmerX = useSharedValue(-SWEEP_WIDTH);
  // OS "remove animations" must silence the shimmer too — an infinitely
  // repeating sweep is exactly what that setting is asking us to stop.
  const { reduced } = useReducedMotion();

  useEffect(() => {
    if (blockWidth <= 0 || reduced) return;
    cancelAnimation(shimmerX);
    shimmerX.value = -(blockWidth + SWEEP_WIDTH);
    shimmerX.value = withRepeat(
      withTiming(blockWidth + SWEEP_WIDTH, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(shimmerX);
  }, [blockWidth, reduced, shimmerX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={{ width: width as number, height, borderRadius, backgroundColor: baseColor ?? colors.surfaceRecessed, overflow: 'hidden' }}
      // Measured even when `reduced` is true: the flag arrives asynchronously
      // and can flip back off mid-skeleton, and onLayout does not re-fire on an
      // already-laid-out view just because the handler was re-attached — so
      // dropping it would leave the shimmer permanently dead at width 0.
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== blockWidth) setBlockWidth(w);
      }}>
      {!reduced && (
        <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
          <LinearGradient
            colors={['transparent', shimmerColor, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={sweep.band}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Home screen panchang card skeleton ──────────────────────────────────────
// Mirrors the 4-row ledger + divider + sunrise/sunset row inside the home
// panchang card. Lives on a NightCard plinth, so it takes its own base /
// shimmer tones rather than the screen's surfaceRecessed (which blends into
// the dark plinth bg).
//
// This is the FIRST thing the launch screen mounts (`panchangLoading` starts
// true), so it deliberately does NOT use SkeletonBlock: 18 blocks × (clip view
// + Animated.View + LinearGradient) is 54 native views, 18 onLayout→setState
// round trips and 18 infinite withRepeat loops competing with the panchang
// compute. Instead the 18 rectangles are inert fills and ONE card-wide
// gradient sweeps across all of them.

/** Inert skeleton rectangle — the sweep lives on the parent, not here. */
function SkeletonFill({
  width,
  height,
  borderRadius = 8,
  color,
}: {
  width: number;
  height: number;
  borderRadius?: number;
  color: string;
}) {
  return <View style={{ width, height, borderRadius, backgroundColor: color }} />;
}

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
  const fill = baseColor ?? colors.surfaceRecessed;
  const divider = dividerColor ?? colors.divider;

  const [cardWidth, setCardWidth] = useState(0);
  const sweepX = useSharedValue(-SWEEP_WIDTH);
  const { reduced } = useReducedMotion();

  useEffect(() => {
    if (cardWidth <= 0 || reduced) return;
    cancelAnimation(sweepX);
    sweepX.value = -SWEEP_WIDTH;
    sweepX.value = withRepeat(
      withTiming(cardWidth, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(sweepX);
  }, [cardWidth, reduced, sweepX]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepX.value }],
  }));

  return (
    <View
      style={sweep.clip}
      // Measured unconditionally — see SkeletonBlock: a handler re-attached
      // after `reduced` flips off never fires on an already-laid-out view.
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== cardWidth) setCardWidth(w);
      }}>
      {/* 4 limb rows — tithi / nakshatra / yoga / karana */}
      <View style={home.rows}>
        {[120, 140, 110, 130].map((valW, i) => (
          <View key={i} style={[home.row, i < 3 && { borderBottomColor: divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <SkeletonFill width={56} height={9} borderRadius={4} color={fill} />
            <View style={home.rowMid}>
              <SkeletonFill width={valW} height={14} borderRadius={4} color={fill} />
            </View>
            <SkeletonFill width={42} height={10} borderRadius={4} color={fill} />
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={[home.divider, { backgroundColor: divider }]} />

      {/* Sunrise / sunset row */}
      <View style={home.sunRow}>
        <View style={home.sunItem}>
          <SkeletonFill width={26} height={26} borderRadius={13} color={fill} />
          <View style={home.sunStack}>
            <SkeletonFill width={50} height={9} borderRadius={4} color={fill} />
            <SkeletonFill width={70} height={12} borderRadius={4} color={fill} />
          </View>
        </View>
        <View style={[home.sunSep, { backgroundColor: divider }]} />
        <View style={home.sunItem}>
          <SkeletonFill width={26} height={26} borderRadius={13} color={fill} />
          <View style={home.sunStack}>
            <SkeletonFill width={50} height={9} borderRadius={4} color={fill} />
            <SkeletonFill width={70} height={12} borderRadius={4} color={fill} />
          </View>
        </View>
      </View>

      {/* The single sweep, painted over every fill above. */}
      {!reduced && cardWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', shimmerColor ?? 'rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={sweep.band}
          />
        </Animated.View>
      )}
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
  // Every `ready` flip (either direction) re-mounts the skeleton for the
  // upcoming fade. Done during render against the last-seen value — React's
  // "adjust state when a prop changes" pattern — so the skeleton lands in the
  // very same commit that adds / removes the content layer, not one effect
  // round-trip later; the effect below then only drives the shared value and
  // the drop-out timer.
  const [prevReady, setPrevReady] = useState(ready);
  if (ready !== prevReady) {
    setPrevReady(ready);
    setShowSkeleton(true);
  }
  const firstRun = useRef(true);

  useEffect(() => {
    // Already-ready at mount: there is nothing to fade from, and running the
    // outbound branch would burn a no-op 300ms timing from progress=1 to
    // progress=1. The ref is CONSUMED on that first run rather than kept as a
    // permanent "was ready at mount" flag — a later true→false→true cycle
    // must still cross-fade normally.
    if (firstRun.current) {
      firstRun.current = false;
      if (ready) return;
    }
    if (ready) {
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
