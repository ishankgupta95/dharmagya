import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GRAHA_ABBR,
  type AspectMap,
  type BirthChart,
  type GrahaName,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, type ColorPalette } from '@/config/theme';
import { localizeRashi } from '@/i18n/panchangNames';
import { resolveLanguage } from '@/i18n';
import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';

const GRAHAS: GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

interface AspectsCardProps {
  d1: BirthChart;
  aspects: AspectMap;
  colors: ColorPalette;
}

export const AspectsCard = memo(function AspectsCard({
  d1,
  aspects,
  colors,
}: AspectsCardProps) {
  const { t } = useTranslation();
  const language = useStore((s) => s.language);
  const lang = resolveLanguage(language);
  const { formatNumber } = useLocaleFormatters();

  // House (1..12) → grahas sitting there. Built once per chart so each row's
  // chip strip is a flat lookup.
  const planetsByHouse = new Map<number, GrahaName[]>();
  for (const p of d1.planets) {
    const list = planetsByHouse.get(p.house);
    if (list) list.push(p.planet);
    else planetsByHouse.set(p.house, [p.planet]);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {GRAHAS.map((graha, i) => {
        const placement = d1.planets.find((p) => p.planet === graha);
        if (!placement) return null;
        const houses = aspects[graha];
        const rashiName = localizeRashi(placement.rashi.name, lang);
        const sitsWith = houses
          .flatMap((h) =>
            (planetsByHouse.get(h) ?? [])
              .filter((g) => g !== graha)
              .map((g) => ({ graha: g, house: h })),
          );

        return (
          <View key={graha}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            <View style={styles.row}>
              <View style={[styles.abbrBadge, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Text variant="mono-caps" style={[styles.abbr, { color: colors.textPrimary }]}>
                  {GRAHA_ABBR[graha]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body-italic" style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {t('aspects.from', {
                    rashi: rashiName,
                    house: formatNumber(placement.house),
                  })}
                </Text>
                <View style={styles.aspectLine}>
                  <Text variant="mono-caps" style={[styles.label, { color: colors.textTertiary }]}>
                    {t('aspects.aspectsLabel')}
                  </Text>
                  <Text variant="mono" style={[styles.houses, { color: colors.textPrimary }]}>
                    {houses.map((h) => formatNumber(h)).join(', ')}
                  </Text>
                </View>
                {sitsWith.length > 0 && (
                  <View style={styles.sitsWithBlock}>
                    <Text variant="mono-caps" style={[styles.label, { color: colors.textTertiary }]}>
                      {t('aspects.sitsWithLabel')}
                    </Text>
                    <View style={styles.chipRow}>
                      {sitsWith.map(({ graha: g, house }, idx) => (
                        <View
                          key={`${g}-${house}-${idx}`}
                          style={[styles.chip, { borderColor: colors.borderAccent, backgroundColor: colors.surfaceRecessed }]}>
                          <Text variant="mono-caps" style={[styles.chipText, { color: colors.textSecondary }]}>
                            {GRAHA_ABBR[g]} · {formatNumber(house)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  abbrBadge: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbr: {
    fontSize: 12,
    letterSpacing: 1.6,
  },
  subtitle: { fontSize: 13, lineHeight: 19 },
  aspectLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  sitsWithBlock: { marginTop: 8 },
  label: {
    fontSize: 9,
    letterSpacing: 1.4,
  },
  houses: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
