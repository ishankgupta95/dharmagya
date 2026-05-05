import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GRAHA_ABBR, type Dignity, type GrahaName } from 'panchang-ts';

import { AppText } from '@/components/common/AppText';
import { palette, borderRadius } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Strip showing each graha's dignity in the natal chart — exalted /
 * moolatrikona / own / friend / neutral / enemy / debilitated. Drives at-a-glance
 * "where is each planet doing well?" reads on the Kundli surface.
 *
 * Dignity order from strongest → weakest follows the library's classical
 * resolution order (see src/jyotish/dignity.ts in panchang-ts).
 */
interface PlanetaryDignityChartProps {
  items: { graha: GrahaName; dignity: Dignity }[];
  /** Optional dignity-key → translated label resolver. */
  labelFor?: (dignity: Dignity) => string;
}

const DIGNITY_TONE: Record<Dignity, { bg: string; fg: string }> = {
  exalted:      { bg: 'rgba(93,202,165,0.18)',  fg: '#3FA37D' }, // green
  moolatrikona: { bg: 'rgba(201,155,58,0.20)',  fg: palette.gold },
  own:          { bg: 'rgba(74,158,245,0.18)',  fg: '#2C7AC9' },
  friend:       { bg: 'rgba(232,168,72,0.18)',  fg: '#BA7E2A' },
  neutral:      { bg: 'rgba(120,120,120,0.18)', fg: '#666' },
  enemy:        { bg: 'rgba(226,75,74,0.18)',   fg: '#A93B3A' },
  debilitated:  { bg: 'rgba(165,48,28,0.20)',   fg: palette.sindoorDeep },
};

export const PlanetaryDignityChart = memo(function PlanetaryDignityChart({
  items,
  labelFor,
}: PlanetaryDignityChartProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const surfaceText = isDark ? palette.boneWhite : palette.ink;

  return (
    <View style={styles.row}>
      {items.map(({ graha, dignity }) => {
        const tone = DIGNITY_TONE[dignity];
        return (
          <View
            key={graha}
            style={[styles.cell, { backgroundColor: tone.bg }]}>
            <AppText variant="mono-caps" style={[styles.abbr, { color: surfaceText }]}>
              {GRAHA_ABBR[graha]}
            </AppText>
            <AppText
              variant="mono"
              style={[styles.dignity, { color: tone.fg }]}
              numberOfLines={1}>
              {labelFor ? labelFor(dignity) : dignity}
            </AppText>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.iconContainer,
    alignItems: 'center',
    gap: 2,
  },
  abbr: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  dignity: {
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
});
