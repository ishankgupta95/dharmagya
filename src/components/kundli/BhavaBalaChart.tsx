import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { BhavaBalaResult } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, palette, type ColorPalette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Twelve stacked bars — one per bhava — visualising the four BPHS Ch. 27
 * sub-strengths (Bhavadhipati / Dik / Drik / Sthana) as a percentage of
 * each bhava's total. Bar length is normalised against the strongest
 * bhava in the chart, so the user reads the comparison internally
 * ("4th and 9th are strongest, 8th is weakest in this chart") without
 * needing an absolute Virupa anchor.
 */
export interface BhavaBalaChartProps {
  bhavaBala: BhavaBalaResult;
  colors: ColorPalette;
}

const COMPONENTS = ['bhavadhipati', 'dik', 'drik', 'sthana'] as const;
type Component = (typeof COMPONENTS)[number];

export const BhavaBalaChart = memo(function BhavaBalaChart({
  bhavaBala,
  colors,
}: BhavaBalaChartProps) {
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);

  const palettePerComponent: Record<Component, string> = isDark
    ? {
        bhavadhipati: palette.goldLeaf,
        dik: 'rgba(232,225,210,0.55)',
        drik: 'rgba(180,150,90,0.85)',
        sthana: 'rgba(232,225,210,0.30)',
      }
    : {
        bhavadhipati: palette.gold,
        dik: 'rgba(46,33,23,0.40)',
        drik: palette.sindoor,
        sthana: 'rgba(46,33,23,0.18)',
      };

  const trackColor = isDark ? 'rgba(232,225,210,0.10)' : 'rgba(46,33,23,0.08)';
  const muted = isDark ? 'rgba(232,225,210,0.55)' : 'rgba(46,33,23,0.5)';

  // Bhava Drik is clamped to ≥ 0; the other three can also be small-positive
  // so we floor each segment at 0 before stacking. The bar's *visible* length
  // tracks `total` directly so the eye reads the gestalt house strength even
  // if one segment dominates.
  const max = bhavaBala.houses.reduce((m, h) => Math.max(m, h.total), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {bhavaBala.houses.map((house, idx) => {
        const bhavaNum = idx + 1;
        const total = Math.max(0, house.total);
        const lengthPct = Math.max(0.02, total / max);
        const segments: { key: Component; pct: number }[] = COMPONENTS.map((key) => {
          const v = Math.max(0, house[key]);
          return { key, pct: total > 0 ? v / total : 0 };
        });
        return (
          <View key={bhavaNum} style={styles.row}>
            <Text variant="mono-caps" style={[styles.label, { color: colors.textSecondary }]}>
              {bhavaNum}
            </Text>
            <View style={[styles.track, { backgroundColor: trackColor }]}>
              <View
                style={[styles.barWrap, { width: `${Math.round(lengthPct * 100)}%` }]}>
                {segments.map((s, si) => (
                  <View
                    key={s.key}
                    style={[
                      styles.segment,
                      {
                        flexGrow: s.pct,
                        backgroundColor: palettePerComponent[s.key],
                        borderTopLeftRadius: si === 0 ? borderRadius.iconContainer : 0,
                        borderBottomLeftRadius: si === 0 ? borderRadius.iconContainer : 0,
                        borderTopRightRadius:
                          si === segments.length - 1 ? borderRadius.iconContainer : 0,
                        borderBottomRightRadius:
                          si === segments.length - 1 ? borderRadius.iconContainer : 0,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text variant="mono" style={[styles.value, { color: muted }]}>
              {Math.round(total)}
            </Text>
          </View>
        );
      })}

      <View style={[styles.legend, { borderTopColor: colors.divider }]}>
        {COMPONENTS.map((c) => (
          <View key={c} style={styles.legendItem}>
            <View
              style={[styles.legendSwatch, { backgroundColor: palettePerComponent[c] }]}
            />
            <Text variant="mono-caps" style={[styles.legendLabel, { color: colors.textTertiary }]}>
              {t(`kundli.bhavaBala.components.${c}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    width: 22,
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: borderRadius.iconContainer,
    overflow: 'hidden',
  },
  barWrap: {
    flexDirection: 'row',
    height: '100%',
  },
  segment: {
    height: '100%',
  },
  value: {
    width: 36,
    fontSize: 11,
    textAlign: 'right',
    letterSpacing: 0.2,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
  },
});
