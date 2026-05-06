import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GRAHA_ABBR, type ShadbalaResult } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, palette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Six-fold strength bars for the seven visible grahas. The library returns
 * Virupas (60 V = 1 Rupa). Classical "minimum required" thresholds vary per
 * planet, but a Sun total of ~390+ and others ~300+ is the rough public-
 * calculator convention. We render the bar as a percentage of the strongest
 * graha in this chart so the comparison is internal — the user reads
 * "Jupiter is strongest, Saturn is weakest in this chart" without needing
 * an absolute Virupa value to anchor against.
 */
export interface ShadbalaChartProps {
  shadbala: ShadbalaResult;
}

const ORDER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;

export const ShadbalaChart = memo(function ShadbalaChart({ shadbala }: ShadbalaChartProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const fg = isDark ? palette.boneWhite : palette.ink;
  const muted = isDark ? 'rgba(232,225,210,0.55)' : 'rgba(46,33,23,0.5)';
  const trackColor = isDark ? 'rgba(232,225,210,0.12)' : 'rgba(46,33,23,0.10)';
  const fillColor = isDark ? palette.goldLeaf : palette.gold;

  const max = ORDER.reduce((m, g) => Math.max(m, shadbala[g].total), 1);

  return (
    <View style={styles.card}>
      {ORDER.map((graha) => {
        const total = shadbala[graha].total;
        const pct = Math.max(0.04, total / max);
        return (
          <View key={graha} style={styles.row}>
            <Text variant="mono-caps" style={[styles.abbr, { color: fg }]}>
              {GRAHA_ABBR[graha]}
            </Text>
            <View style={[styles.track, { backgroundColor: trackColor }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(pct * 100)}%`, backgroundColor: fillColor },
                ]}
              />
            </View>
            <Text variant="mono" style={[styles.value, { color: muted }]}>
              {Math.round(total)}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  abbr: {
    width: 28,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: borderRadius.iconContainer,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.iconContainer,
  },
  value: {
    width: 36,
    fontSize: 11,
    textAlign: 'right',
    letterSpacing: 0.2,
  },
});
