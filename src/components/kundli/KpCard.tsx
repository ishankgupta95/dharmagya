import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GRAHA_ABBR,
  type GrahaName,
  type KpCuspalSubLords,
  type KpSignificators,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { SectionLabel } from '@/components/common/SectionLabel';
import { borderRadius, type ColorPalette } from '@/config/theme';
import { useLocaleFormatters } from '@/utils/format';

interface KpCardProps {
  /** Cached `computeKpCuspalSubLordsCached` output. */
  cuspal: KpCuspalSubLords | null;
  /** Bundle.kpSignificators — pure D1 lookup. */
  significators: KpSignificators;
  colors: ColorPalette;
}

const GRAHAS: GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

export const KpCard = memo(function KpCard({ cuspal, significators, colors }: KpCardProps) {
  const { t } = useTranslation();
  const { formatNumber, digits } = useLocaleFormatters();

  return (
    <View>
      {/* ── Cuspal sub-lords (12 cusps) ──────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.kp.cuspalSection')}
      </SectionLabel>
      {cuspal ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.cuspalHeaderRow, { borderBottomColor: colors.divider }]}>
            <Text variant="mono-caps" style={[styles.cuspalHead, { color: colors.textTertiary, width: 22 }]}>
              {t('kundli.kp.colHouse')}
            </Text>
            <Text variant="mono-caps" style={[styles.cuspalHead, { color: colors.textTertiary, flex: 1 }]}>
              {t('kundli.kp.colCusp')}
            </Text>
            <Text variant="mono-caps" style={[styles.cuspalHead, { color: colors.textTertiary, width: 56 }]}>
              {t('kundli.kp.colSign')}
            </Text>
            <Text variant="mono-caps" style={[styles.cuspalHead, { color: colors.textTertiary, width: 56 }]}>
              {t('kundli.kp.colStar')}
            </Text>
            <Text variant="mono-caps" style={[styles.cuspalHead, { color: colors.textTertiary, width: 56, textAlign: 'right' }]}>
              {t('kundli.kp.colSub')}
            </Text>
          </View>
          {cuspal.cusps.map((c, i) => (
            <View
              key={i}
              style={[
                styles.cuspalRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
              ]}>
              <Text variant="mono-caps" style={[styles.cuspalHouse, { color: colors.textTertiary, width: 22 }]}>
                {formatNumber(i + 1)}
              </Text>
              <Text variant="mono" style={[styles.cuspalDeg, { color: colors.textPrimary, flex: 1 }]}>
                {digits(c.longitude.toFixed(2))}°
              </Text>
              <Text variant="mono-caps" style={[styles.cuspalLord, { color: colors.textSecondary, width: 56 }]}>
                {GRAHA_ABBR[c.signLord as GrahaName]}
              </Text>
              <Text variant="mono-caps" style={[styles.cuspalLord, { color: colors.textSecondary, width: 56 }]}>
                {GRAHA_ABBR[c.starLord as GrahaName]}
              </Text>
              <Text
                variant="mono-caps"
                style={[styles.cuspalLord, { color: colors.textPrimary, width: 56, textAlign: 'right' }]}>
                {GRAHA_ABBR[c.subLord as GrahaName]}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="body-italic" style={[styles.empty, { color: colors.textMuted }]}>
          {t('kundli.kp.cuspalFailed')}
        </Text>
      )}
      <Text variant="body-italic" style={[styles.note, { color: colors.textMuted }]}>
        {t('kundli.kp.ayanamsaNote')}
      </Text>

      {/* ── Significators (per-graha houses signified) ──────────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.kp.significatorsSection')}
      </SectionLabel>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {GRAHAS.map((graha, i) => {
          const houses = significators.byPlanet[graha] ?? [];
          return (
            <View
              key={graha}
              style={[
                styles.sigRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
              ]}>
              <View style={[styles.grahaBadge, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Text variant="mono-caps" style={[styles.grahaBadgeText, { color: colors.textPrimary }]}>
                  {GRAHA_ABBR[graha]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="mono-caps" style={[styles.sigLabel, { color: colors.textTertiary }]}>
                  {t('kundli.kp.signifies')}
                </Text>
                {houses.length === 0 ? (
                  <Text variant="body-italic" style={[styles.sigEmpty, { color: colors.textMuted }]}>
                    {t('kundli.kp.noHouses')}
                  </Text>
                ) : (
                  <View style={styles.houseChipRow}>
                    {houses.map((h) => (
                      <View
                        key={h}
                        style={[styles.houseChip, { borderColor: colors.borderAccent, backgroundColor: colors.surfaceRecessed }]}>
                        <Text variant="mono-caps" style={[styles.houseChipText, { color: colors.textSecondary }]}>
                          {formatNumber(h)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

    </View>
  );
});

const styles = StyleSheet.create({
  sectionLabel: { marginTop: 18, marginBottom: 8 },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

  cuspalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cuspalHead: { fontSize: 8, letterSpacing: 1.2 },

  cuspalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cuspalHouse: { fontSize: 11, letterSpacing: 1.2 },
  cuspalDeg: { fontSize: 12, letterSpacing: 0.2 },
  cuspalLord: { fontSize: 10, letterSpacing: 1.2 },

  note: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    paddingHorizontal: 4,
  },

  sigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  grahaBadge: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grahaBadgeText: { fontSize: 11, letterSpacing: 1.4 },
  sigLabel: { fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  sigEmpty: { fontSize: 12, lineHeight: 18 },
  houseChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  houseChip: {
    width: 28,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  houseChipText: { fontSize: 10, letterSpacing: 1.0 },

  empty: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
});
