import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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

// ─── Base shimmer block ───────────────────────────────────────────────────────

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  colors: ColorPalette;
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  colors,
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
      style={{ width: width as number, height, borderRadius, backgroundColor: colors.surfaceRecessed, overflow: 'hidden' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== blockWidth) setBlockWidth(w);
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 200, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Home screen panchang card skeleton ──────────────────────────────────────
// Mirrors the 2×2 grid + divider + sunrise/sunset row inside the home panchang card.

export function HomePanchangSkeleton({ colors }: { colors: ColorPalette }) {
  return (
    <View>
      {/* 2×2 grid cells */}
      <View style={home.grid}>
        {[80, 100, 70, 90].map((valueW, i) => (
          <View key={i} style={home.cell}>
            <SkeletonBlock width={52} height={10} borderRadius={4} colors={colors} />
            <SkeletonBlock width={valueW} height={17} borderRadius={5} colors={colors} />
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={[home.divider, { backgroundColor: colors.divider }]} />

      {/* Sunrise / sunset row */}
      <View style={home.sunRow}>
        <View style={home.sunItem}>
          <SkeletonBlock width={14} height={14} borderRadius={7} colors={colors} />
          <SkeletonBlock width={90} height={12} borderRadius={4} colors={colors} />
        </View>
        <View style={[home.sunSep, { backgroundColor: colors.divider }]} />
        <View style={home.sunItem}>
          <SkeletonBlock width={14} height={14} borderRadius={7} colors={colors} />
          <SkeletonBlock width={90} height={12} borderRadius={4} colors={colors} />
        </View>
      </View>
    </View>
  );
}

const home = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  cell: { width: '50%', paddingVertical: 6, gap: 6 },
  divider: { height: 0.5, marginVertical: 12 },
  sunRow: { flexDirection: 'row', alignItems: 'center' },
  sunItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sunSep: { width: 0.5, height: 20, marginHorizontal: 12 },
});

// ─── Full panchang screen skeleton ────────────────────────────────────────────
// Mirrors the date header area + Pancha Anga card with 5 limb rows.

export function PanchangSkeleton({ colors }: { colors: ColorPalette }) {
  return (
    <View style={{ gap: 16, paddingTop: 8 }}>

      {/* Date display area */}
      <View style={{ alignItems: 'center', gap: 10 }}>
        <SkeletonBlock width={160} height={14} colors={colors} />
        <SkeletonBlock width={60} height={42} colors={colors} />
        <SkeletonBlock width={200} height={14} colors={colors} />
        <SkeletonBlock width={120} height={12} colors={colors} />
      </View>

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
