import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DEITY_BY_ID } from '@/config/deities';
import { getDeityImage } from '@/config/deityImages';
import { deityColors, palette } from '@/config/theme';

import { AppText } from './AppText';

interface DeityAvatarProps {
  /** Deity slug (e.g. "ganesha"). Matches `Deity` from hindu-devotional-texts. */
  deity: string;
  size?: number;
  /** Sacred Editorial double ring (bone-white over gold rule) — default.
   *  `'none'` drops the decoration for tight grid layouts. */
  ring?: 'editorial' | 'none';
}

const FALLBACK = { initial: 'ॐ', color: deityColors.ganesha };

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const RING_GOLD = 1;     // outer gold-rule ring thickness
const RING_PARCHMENT = 2; // inner parchment-bright ring thickness

export const DeityAvatar = memo(function DeityAvatar({
  deity,
  size = 48,
  ring = 'editorial',
}: DeityAvatarProps) {
  const meta = DEITY_BY_ID[deity];
  const color = meta?.color ?? FALLBACK.color;
  const image = getDeityImage(deity);
  const showRing = ring === 'editorial';

  const ringPad = showRing ? RING_GOLD + RING_PARCHMENT : 0;
  const innerSize = size - ringPad * 2;
  const outerRadius = size / 2;
  const innerRadius = innerSize / 2;

  const gradientColors = useMemo(
    () => [color + '55', color + '22'] as const,
    [color]
  );

  const inner = image ? (
    <Image
      source={image}
      style={{ width: innerSize, height: innerSize, borderRadius: innerRadius }}
      resizeMode="cover"
    />
  ) : (
    <LinearGradient
      colors={gradientColors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.avatar, { width: innerSize, height: innerSize, borderRadius: innerRadius }]}>
      <AppText
        variant="deva-bold"
        style={{ fontSize: innerSize * 0.42, color, lineHeight: innerSize * 0.9 }}>
        {meta?.initial ?? FALLBACK.initial}
      </AppText>
    </LinearGradient>
  );

  if (!showRing) {
    return (
      <View style={[styles.flush, { width: size, height: size, borderRadius: outerRadius }]}>
        {inner}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.goldRing,
        {
          width: size,
          height: size,
          borderRadius: outerRadius,
          padding: RING_GOLD,
        },
      ]}>
      <View
        style={[
          styles.parchmentRing,
          {
            borderRadius: outerRadius - RING_GOLD,
            padding: RING_PARCHMENT,
          },
        ]}>
        {inner}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  flush: {
    overflow: 'hidden',
  },
  goldRing: {
    backgroundColor: palette.rule,
  },
  parchmentRing: {
    flex: 1,
    backgroundColor: palette.parchmentBright,
    overflow: 'hidden',
  },
});
