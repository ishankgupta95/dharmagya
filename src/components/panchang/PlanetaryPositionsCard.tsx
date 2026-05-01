import { View, StyleSheet } from 'react-native';
import { GRAHA_ABBR, type GrahaName } from 'panchang-ts';
import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, spacing, type ColorPalette } from '@/config/theme';
import type { IGrahaPosition } from '@/types';

const PLANET_GLYPH: Record<GrahaName, string> = {
  Sun: '☉',      // ☉
  Moon: '☽',     // ☽
  Mars: '♂',     // ♂
  Mercury: '☿',  // ☿
  Jupiter: '♃',  // ♃
  Venus: '♀',    // ♀
  Saturn: '♄',   // ♄
  Rahu: '☊',     // ☊
  Ketu: '☋',     // ☋
};

interface Props {
  positions: IGrahaPosition[];
  colors: ColorPalette;
}

export function PlanetaryPositionsCard({ positions, colors }: Props) {
  return (
    <View style={styles.grid}>
      {positions.map((p) => {
        const glyph = PLANET_GLYPH[p.planetEn] ?? '✶';
        return (
          <View
            key={p.planetEn}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.glyph, { color: colors.emphasis }]}>{glyph}</Text>
            <Text variant="mono-caps" style={[styles.name, { color: colors.textTertiary }]} numberOfLines={1}>
              {p.planet}
              {p.isRetrograde ? ' ℞' : ''}
            </Text>
            <Text
              variant="body-italic"
              style={[styles.sign, { color: colors.textPrimary }]}
              numberOfLines={1}>
              {p.rashi}
            </Text>
            <Text
              variant="mono"
              style={[styles.abbr, { color: colors.textMuted }]}
              numberOfLines={1}>
              {`${GRAHA_ABBR[p.planetEn]} ${p.degreeInRashi.toFixed(1)}°`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.cardGap,
  },
  tile: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: borderRadius.cardInner,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
  },
  glyph: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 22,
    lineHeight: 24,
  },
  name: {
    fontSize: 8.5,
    marginTop: 4,
  },
  sign: {
    fontSize: 11,
    marginTop: 1,
  },
  abbr: {
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.3,
  },
});
